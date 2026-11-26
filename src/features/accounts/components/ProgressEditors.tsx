import { z } from 'zod/v4';
import React, { useRef, useState } from 'react';
import {
  Controller,
  useForm,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { selectCopy, useLanguage } from '@/i18n/Language';
import { Button } from '@/components/Button';
import { DatePickerCalendar, DatePickerField } from '@/components/DatePickerField';
import { TextField } from '@/components/TextField';
import { ApiError } from '@/services/apiClient';
import { radii, spacing, textStyles, usePalette } from '@/theme/tokens';
import { displayWeight, type MeasurementSystem } from '../profileForm';
import { progressApi } from '../progressApi';
import {
  latestMeasurementDraft,
  measurementDefaults,
  measurementFormSchema,
  measurementUnit,
  targetFormSchema,
  todayForProfile,
  type MeasurementFormValues,
  type TargetFormValues,
} from '../progressForm';
import {
  measurementDefinitions,
  type BodyMeasurement,
  type MeasurementMetric,
  type PhysicalTarget,
} from '../progressSchemas';
import type { Objective } from '../schemas';

function progressError(message: string, es: boolean) {
  if (!es) return message;
  const messages: Record<string, string> = {
    'Enter whole feet from 0 to 9.': 'Introduce pies enteros entre 0 y 9.',
    'Enter inches from 0 to less than 12.': 'Introduce pulgadas desde 0 hasta menos de 12.',
    'Enter a number with up to two decimal places.':
      'Introduce un número con dos decimales como máximo.',
    'Enter a valid date in YYYY-MM-DD format.': 'Introduce una fecha válida en formato AAAA-MM-DD.',
    'Choose today or an earlier date.': 'Elige hoy o una fecha anterior.',
    'Enter at least one measurement.': 'Introduce al menos una medida.',
    'Enter a target weight with up to two decimal places.':
      'Introduce un peso objetivo con dos decimales como máximo.',
    'Could not save your measurements. Try again.':
      'No se pudieron guardar tus medidas. Inténtalo de nuevo.',
    'Your objective changed. Close this form to load the current target.':
      'Tu objetivo ha cambiado. Cierra este formulario para cargar el objetivo actual.',
    'Could not save your target. Try again.': 'No se pudo guardar tu objetivo. Inténtalo de nuevo.',
  };
  if (messages[message]) return messages[message];
  for (const definition of Object.values(measurementDefinitions)) {
    if (message.startsWith(`${definition.label} must be `)) {
      return message
        .replace(
          `${definition.label} must be greater than 0 and at most `,
          `${definition.labelEs}: introduce un valor mayor que 0 y como máximo `,
        )
        .replace(
          `${definition.label} must be 0 to `,
          `${definition.labelEs}: introduce un valor entre 0 y `,
        );
    }
  }
  return message;
}

type CalendarRequest = Readonly<{
  label: string;
  value: string;
  today: string;
  maxDate?: string;
  onSelect: (date: string) => void;
}>;

function ProgressDialog({
  title,
  children,
  busy,
  error,
  saveLabel,
  onClose,
  onSave,
}: Readonly<{
  title: string;
  busy: boolean;
  error: string;
  saveLabel: string;
  onClose: () => void;
  onSave: () => void;
  children: (openCalendar: (request: CalendarRequest) => void) => React.ReactNode;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const { height } = useWindowDimensions();
  const [calendar, setCalendar] = useState<CalendarRequest | null>(null);
  const dialogColors = {
    backgroundColor: p['surface-200'],
    maxHeight: height - spacing['space-6'],
  };

  function openCalendar(request: CalendarRequest) {
    Keyboard.dismiss();
    setCalendar(request);
  }

  function closeCalendar() {
    setCalendar(null);
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      accessibilityLabel={calendar?.label ?? title}
      onRequestClose={calendar ? closeCalendar : onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: p.scrim }]}
      >
        <View
          accessibilityViewIsModal={!calendar}
          accessibilityElementsHidden={Boolean(calendar)}
          importantForAccessibility={calendar ? 'no-hide-descendants' : 'auto'}
          aria-hidden={Boolean(calendar)}
          style={[styles.dialog, dialogColors, calendar && styles.hidden]}
        >
          <Text
            accessibilityRole="header"
            style={[textStyles['title-lg'], styles.dialogTitle, { color: p.ink }]}
          >
            {title}
          </Text>
          <ScrollView
            style={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.fields}
          >
            {children(openCalendar)}
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: p.line }]}>
            {error ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {progressError(error, es)}
              </Text>
            ) : null}
            <View style={styles.actionRow}>
              <View style={styles.grow}>
                <Button
                  title={selectCopy(es, 'Cancelar', 'Cancel')}
                  shape="rounded"
                  secondary
                  disabled={busy}
                  onPress={onClose}
                />
              </View>
              <View style={styles.saveAction}>
                <Button
                  shape="rounded"
                  title={busy ? selectCopy(es, 'Guardando…', 'Saving…') : saveLabel}
                  accessibilityLabel={saveLabel}
                  disabled={busy}
                  onPress={onSave}
                />
              </View>
            </View>
          </View>
        </View>
        {calendar ? (
          <View
            accessibilityViewIsModal
            style={[styles.dialog, styles.calendarDialog, dialogColors]}
          >
            <Text
              accessibilityRole="header"
              style={[textStyles['title-lg'], styles.dialogTitle, { color: p.ink }]}
            >
              {calendar.label}
            </Text>
            <ScrollView style={styles.formScroll} contentContainerStyle={styles.calendarContent}>
              <DatePickerCalendar
                value={calendar.value}
                today={calendar.today}
                maxDate={calendar.maxDate}
                onSelect={(date) => {
                  calendar.onSelect(date);
                  closeCalendar();
                }}
              />
            </ScrollView>
            <View style={[styles.actions, { borderTopColor: p.line }]}>
              <Button
                title={selectCopy(es, 'Cancelar', 'Cancel')}
                shape="rounded"
                secondary
                onPress={closeCalendar}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProgressField<T extends FieldValues>({
  name,
  control,
  label,
  disabled,
  mode = 'decimal',
  compact,
}: Readonly<{
  name: FieldPathByValue<T, string>;
  control: Control<T>;
  label: string;
  disabled: boolean;
  mode?: 'decimal' | 'integer';
  compact?: boolean;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={[styles.field, compact && styles.gridField]}>
          <Text style={[textStyles.label, { color: p.ink }]}>{label}</Text>
          <TextField
            accessibilityLabel={label}
            editable={!disabled}
            invalid={Boolean(fieldState.error)}
            inputMode={mode === 'integer' ? 'numeric' : 'decimal'}
            maxLength={8}
            autoCapitalize="none"
            autoCorrect={false}
            value={typeof field.value === 'string' ? field.value : ''}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
          />
          {fieldState.error?.message ? (
            <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
              {progressError(fieldState.error.message, es)}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}

function ProgressDate<T extends FieldValues>({
  name,
  control,
  label,
  today,
  disabled,
  optional,
  openCalendar,
}: Readonly<{
  name: FieldPathByValue<T, string>;
  control: Control<T>;
  label: string;
  today: string;
  disabled: boolean;
  optional?: boolean;
  openCalendar: (request: CalendarRequest) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = typeof field.value === 'string' ? field.value : '';
        const onSelect = (date: string) => {
          field.onChange(date);
          field.onBlur();
        };
        return (
          <View style={styles.field}>
            <DatePickerField
              label={label}
              value={value}
              optional={optional}
              disabled={disabled}
              invalid={Boolean(fieldState.error)}
              onClear={() => onSelect('')}
              onOpen={() =>
                openCalendar({
                  label,
                  value,
                  today,
                  maxDate: optional ? undefined : today,
                  onSelect,
                })
              }
            />
            {fieldState.error?.message ? (
              <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
                {progressError(fieldState.error.message, es)}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const circumferenceMetrics = ['waist_cm', 'chest_cm', 'arm_cm', 'thigh_cm'] as const;

export function MeasurementEditor({
  system,
  timeZone,
  history,
  onClose,
  onSaved,
}: Readonly<{
  system: MeasurementSystem;
  timeZone: string | null;
  history: readonly BodyMeasurement[];
  onClose: () => void;
  onSaved: (measurement: BodyMeasurement) => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  const today = todayForProfile(timeZone);
  const [initial] = useState(() => latestMeasurementDraft(today, system, history));
  const { control, handleSubmit, setError } = useForm<MeasurementFormValues>({
    defaultValues: initial.values,
  });
  const requestIds = useRef(new Map<string, string>());
  const busy = useRef(false);
  const [formError, setFormError] = useState('');
  const mutation = useMutation({ mutationFn: progressApi.record });

  function dismiss() {
    if (!busy.current) onClose();
  }

  async function save(values: MeasurementFormValues) {
    if (busy.current) return;
    setFormError('');
    const result = measurementFormSchema(system, today, initial).safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const name = measurementFields.find((field) => field === issue.path[0]);
        if (name) setError(name, { type: 'validate', message: issue.message });
        else setFormError(issue.message);
      }
      return;
    }
    busy.current = true;
    const payloadKey = JSON.stringify(result.data);
    try {
      const requestId = requestIds.current.get(payloadKey) ?? randomUUID();
      requestIds.current.set(payloadKey, requestId);
      const saved = await mutation.mutateAsync({ ...result.data, request_id: requestId });
      onSaved(saved);
    } catch {
      setFormError('Could not save your measurements. Try again.');
    } finally {
      busy.current = false;
    }
  }

  function field(metric: MeasurementMetric) {
    const definition = measurementDefinitions[metric];
    const label = es ? definition.labelEs : definition.label;
    return (
      <ProgressField
        key={metric}
        name={metric}
        control={control}
        label={`${label} (${measurementUnit(metric, system)})`}
        disabled={mutation.isPending}
        compact
      />
    );
  }

  return (
    <ProgressDialog
      title={selectCopy(es, 'Registrar medidas', 'Log measurements')}
      busy={mutation.isPending}
      error={formError}
      saveLabel={selectCopy(es, 'Guardar medidas', 'Save measurements')}
      onClose={dismiss}
      onSave={() => void handleSubmit(save)()}
    >
      {(openCalendar) => (
        <>
          <ProgressDate
            name="date"
            control={control}
            openCalendar={openCalendar}
            label={selectCopy(es, 'Fecha de medición', 'Measurement date')}
            today={today}
            disabled={mutation.isPending}
          />
          <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
            {Object.keys(initial.previous).length
              ? selectCopy(
                  es,
                  'Se han rellenado los valores anteriores. Borra los que quieras omitir.',
                  'Previous values are filled in. Clear any you want to skip.',
                )
              : selectCopy(
                  es,
                  'Añade las medidas que tomaste. Deja las demás vacías.',
                  'Add the measurements you took. Leave the others blank.',
                )}
          </Text>
          <View style={styles.fieldGroup}>
            {field('weight_kg')}
            {system === 'metric' ? (
              field('height_cm')
            ) : (
              <>
                <ProgressField
                  name="height_ft"
                  control={control}
                  label={selectCopy(es, 'Altura (pies)', 'Height (ft)')}
                  compact
                  disabled={mutation.isPending}
                  mode="integer"
                />
                <ProgressField
                  name="height_in"
                  control={control}
                  label={selectCopy(es, 'Altura (pulgadas)', 'Height (in)')}
                  compact
                  disabled={mutation.isPending}
                />
              </>
            )}
            {field('body_fat_percentage')}
            {field('muscle_mass_kg')}
          </View>
          <View style={[styles.section, { borderTopColor: p.line }]}>
            <Text accessibilityRole="header" style={[textStyles.label, { color: p.ink }]}>
              {selectCopy(es, 'Perímetro', 'Circumference')}
            </Text>
            <View style={styles.fieldGroup}>{circumferenceMetrics.map(field)}</View>
          </View>
        </>
      )}
    </ProgressDialog>
  );
}

const measurementFields = Object.keys(measurementDefaults('')) as (keyof MeasurementFormValues)[];

export function PhysicalTargetEditor({
  objective,
  target,
  system,
  timeZone,
  onClose,
  onSaved,
  onObjectiveChanged,
}: Readonly<{
  objective: Objective;
  target: PhysicalTarget['target'];
  system: MeasurementSystem;
  timeZone: string | null;
  onClose: () => void;
  onSaved: (result: PhysicalTarget) => void;
  onObjectiveChanged: () => void;
}>) {
  const es = useLanguage() === 'es';
  const { control, handleSubmit, setError } = useForm<TargetFormValues>({
    defaultValues: {
      weight_kg: target ? displayWeight(target.weight_kg, system) : '',
      target_date: target?.target_date ?? '',
    },
  });
  const busy = useRef(false);
  const [formError, setFormError] = useState('');
  const [staleObjective, setStaleObjective] = useState(false);
  const mutation = useMutation({ mutationFn: progressApi.saveTarget });
  function dismiss() {
    if (busy.current) return;
    if (staleObjective) onObjectiveChanged();
    onClose();
  }
  async function save(values: TargetFormValues) {
    if (busy.current || staleObjective) return;
    setFormError('');
    const result = targetFormSchema(system, target?.weight_kg ?? null).safeParse(values);
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      for (const name of ['weight_kg', 'target_date'] as const)
        if (fieldErrors[name]?.[0])
          setError(name, { type: 'validate', message: fieldErrors[name][0] });
      return;
    }
    busy.current = true;
    try {
      onSaved(await mutation.mutateAsync({ ...result.data, objective }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStaleObjective(true);
        setFormError('Your objective changed. Close this form to load the current target.');
      } else {
        setFormError('Could not save your target. Try again.');
      }
    } finally {
      busy.current = false;
    }
  }
  return (
    <ProgressDialog
      title={
        target
          ? selectCopy(es, 'Editar peso objetivo', 'Edit weight target')
          : selectCopy(es, 'Fijar peso objetivo', 'Set weight target')
      }
      busy={mutation.isPending}
      error={formError}
      saveLabel={
        staleObjective
          ? selectCopy(es, 'Listo', 'Done')
          : selectCopy(es, 'Guardar objetivo', 'Save target')
      }
      onSave={staleObjective ? dismiss : () => void handleSubmit(save)()}
      onClose={dismiss}
    >
      {(openCalendar) => (
        <>
          <ProgressField
            name="weight_kg"
            control={control}
            label={`${selectCopy(es, 'Peso objetivo', 'Target weight')} (${measurementUnit('weight_kg', system)})`}
            disabled={mutation.isPending || staleObjective}
          />
          <ProgressDate
            name="target_date"
            control={control}
            openCalendar={openCalendar}
            label={selectCopy(es, 'Fecha objetivo', 'Target date')}
            today={todayForProfile(timeZone)}
            disabled={mutation.isPending || staleObjective}
            optional
          />
        </>
      )}
    </ProgressDialog>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['space-4'],
  },
  dialog: {
    width: '100%',
    maxWidth: 500,
    borderRadius: radii['radius-lg'],
    overflow: 'hidden',
    flexShrink: 1,
  },
  hidden: { display: 'none' },
  calendarDialog: { maxWidth: 372 },
  calendarContent: {
    paddingHorizontal: spacing['space-4'],
    paddingBottom: spacing['space-3'],
  },
  dialogTitle: {
    paddingTop: spacing['space-5'],
    paddingHorizontal: spacing['space-5'],
    paddingBottom: spacing['space-3'],
  },
  formScroll: { flexGrow: 0, flexShrink: 1 },
  fields: {
    paddingHorizontal: spacing['space-5'],
    paddingBottom: spacing['space-4'],
    gap: spacing['space-3'],
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['space-3'],
    gap: spacing['space-2'],
  },
  fieldGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['space-3'],
  },
  field: { gap: spacing['space-1'] },
  gridField: { minWidth: 118, flexBasis: '45%', flexGrow: 1 },
  actions: {
    gap: spacing['space-2'],
    paddingVertical: spacing['space-3'],
    paddingHorizontal: spacing['space-5'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-2'] },
  grow: { flexGrow: 1 },
  saveAction: { flexGrow: 2 },
});
