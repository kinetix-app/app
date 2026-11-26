import { getTranslation } from '@/i18n/catalog';
import type { ViewInstance } from 'react-native';
import { useLanguage } from '@/i18n/Language';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { ApiError } from '@/services/apiClient';
import { radii, sizes, spacing, textStyles, usePalette } from '@/theme/tokens';

type RoutineActionsMenuProps = Readonly<{
  name: string;
  canStart: boolean;
  canDelete: boolean;
  startHint?: string;
  onClose: () => void;
  onEdit: () => void;
  hasCover: boolean;
  coverPending: boolean;
  coverError: string;
  onChooseCover: () => void;
  onRemoveCover: () => void;
  onRetryCover?: () => void;
  onStart: () => void;
  onDelete: () => void;
  deleting: boolean;
  deleteError: unknown;
}>;

export function RoutineActionsMenu(props: RoutineActionsMenuProps) {
  const { name, onClose, onDelete, deleting, deleteError, coverPending } = props;
  const p = usePalette();
  const es = useLanguage() === 'es';
  const busy = deleting || coverPending;
  const insets = useSafeAreaInsets();
  const first = useRef<ViewInstance>(null);
  const [confirming, setConfirming] = useState(false);
  const error =
    deleteError instanceof ApiError && deleteError.status === 409
      ? getTranslation(es ? 'es' : 'en')('training.thisRoutineHasAnOngoingWorkoutFinish_9a6722')
      : getTranslation(es ? 'es' : 'en')('training.couldNotDeleteTheRoutineTryAgain_a57a1b');
  function close() {
    if (!busy) onClose();
  }
  return (
    <Modal
      transparent
      visible
      animationType={Platform.OS === 'web' ? 'none' : 'slide'}
      onRequestClose={close}
      onShow={() => first.current?.focus()}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          testID="routine-actions-backdrop"
          accessible={false}
          disabled={busy}
          onPress={close}
          style={{ position: 'absolute', inset: 0, backgroundColor: p.scrim }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={
            confirming
              ? getTranslation(es ? 'es' : 'en')('dynamicMessages.delete_602940', { value1: name })
              : getTranslation(es ? 'es' : 'en')('dynamicMessages.actionsFor_f7a9e1', {
                  value1: name,
                })
          }
          style={{
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
            maxHeight: '90%',
            backgroundColor: p['surface-200'],
            borderTopLeftRadius: radii['radius-xl'],
            borderTopRightRadius: radii['radius-xl'],
            paddingBottom: Math.max(insets.bottom, spacing['space-4']),
          }}
        >
          <View
            accessible={false}
            style={{
              width: spacing['space-10'],
              height: spacing['space-1'],
              backgroundColor: p['line-strong'],
              borderRadius: radii['radius-pill'],
              alignSelf: 'center',
              marginTop: spacing['space-3'],
              marginBottom: spacing['space-5'],
            }}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: spacing['space-5'],
              gap: spacing['space-4'],
            }}
          >
            <View style={{ gap: spacing['space-1'] }}>
              <Text accessibilityRole="header" style={[textStyles['title-lg'], { color: p.ink }]}>
                {confirming
                  ? getTranslation(es ? 'es' : 'en')('training.deleteRoutine_36c655')
                  : name}
              </Text>
              {confirming ? (
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  {getTranslation(es ? 'es' : 'en')(
                    'training.thisRoutineWillBeRemovedFromYour_58f5f1',
                  )}
                </Text>
              ) : null}
            </View>
            {confirming ? (
              <DeleteRoutineConfirmation
                name={name}
                busy={busy}
                deleting={deleting}
                deleteError={deleteError}
                error={error}
                onDelete={onDelete}
              />
            ) : (
              <RoutineActionOptions
                {...props}
                busy={busy}
                first={first}
                onConfirmDelete={() => setConfirming(true)}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                confirming
                  ? getTranslation(es ? 'es' : 'en')('training.keepRoutine_c9f850')
                  : getTranslation(es ? 'es' : 'en')('training.closeRoutineActions_0aa88e')
              }
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => (confirming ? setConfirming(false) : close())}
              style={({ pressed }) => ({
                minHeight: sizes['control-height'],
                justifyContent: 'center',
                alignItems: 'center',
                opacity: busy || pressed ? 0.55 : 1,
              })}
            >
              <Text style={[textStyles.label, { color: p.ink }]}>
                {confirming
                  ? getTranslation(es ? 'es' : 'en')('training.keepRoutine_c9f850')
                  : getTranslation(es ? 'es' : 'en')('training.cancel_a25d0b')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DeleteRoutineConfirmation({
  name,
  busy,
  deleting,
  deleteError,
  error,
  onDelete,
}: Readonly<{
  name: string;
  busy: boolean;
  deleting: boolean;
  deleteError: unknown;
  error: string;
  onDelete: () => void;
}>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      {deleteError ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={getTranslation(es ? 'es' : 'en')(
          'dynamicMessages.confirmDelete_9870e6',
          { value1: name },
        )}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onDelete}
        style={({ pressed }) => ({
          minHeight: sizes['control-height'],
          borderRadius: radii['radius-md'],
          padding: spacing['space-4'],
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing['space-2'],
          backgroundColor: p['surface-300'],
          borderWidth: 1,
          borderColor: p.danger,
          opacity: busy || pressed ? 0.55 : 1,
        })}
      >
        {deleting ? (
          <ActivityIndicator color={p.danger} />
        ) : (
          <Feather name="trash-2" size={20} color={p.danger} />
        )}
        <Text style={[textStyles.label, { color: p.danger }]}>
          {deleting
            ? getTranslation(es ? 'es' : 'en')('training.deleting_467f44')
            : getTranslation(es ? 'es' : 'en')('training.deleteRoutine_ce5d0f')}
        </Text>
      </Pressable>
    </>
  );
}

function RoutineActionOptions({
  name,
  canStart,
  canDelete,
  startHint,
  onStart,
  onEdit,
  hasCover,
  coverPending,
  coverError,
  onChooseCover,
  onRemoveCover,
  onRetryCover,
  busy,
  first,
  onConfirmDelete,
}: RoutineActionsMenuProps &
  Readonly<{
    busy: boolean;
    first: React.RefObject<ViewInstance | null>;
    onConfirmDelete: () => void;
  }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      <View
        style={{
          backgroundColor: p['surface-300'],
          borderRadius: radii['radius-lg'],
          overflow: 'hidden',
        }}
      >
        <Pressable
          ref={canStart ? first : undefined}
          accessibilityRole="button"
          accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.train_8edf48', {
            value1: name,
          })}
          accessibilityState={{ disabled: !canStart || busy }}
          disabled={!canStart || busy}
          onPress={onStart}
          style={({ pressed }) => ({
            minHeight: sizes['control-height'],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['space-3'],
            padding: spacing['space-4'],
            backgroundColor: pressed ? p['brand-soft'] : 'transparent',
            opacity: canStart ? 1 : 0.55,
          })}
        >
          <MaterialIcons name="play-arrow" size={26} color={p['brand-ink']} />
          <Text style={[textStyles.body, { color: p['brand-ink'] }]}>
            {getTranslation(es ? 'es' : 'en')('training.train_73ad48')}
          </Text>
        </Pressable>
        <View
          style={{
            height: 1,
            backgroundColor: p.line,
            marginHorizontal: spacing['space-4'],
          }}
        />
        <Pressable
          ref={!canStart ? first : undefined}
          accessibilityRole="button"
          accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.edit_a899b6', {
            value1: name,
          })}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onEdit}
          style={({ pressed }) => ({
            minHeight: sizes['control-height'],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['space-3'],
            padding: spacing['space-4'],
            backgroundColor: pressed ? p['surface-200'] : 'transparent',
          })}
        >
          <Feather name="edit-2" size={22} color={p.ink} />
          <Text style={[textStyles.body, { color: p.ink }]}>
            {getTranslation(es ? 'es' : 'en')('training.edit_dac3da')}
          </Text>
        </Pressable>
      </View>
      <RoutineCoverActions
        name={name}
        hasCover={hasCover}
        busy={busy}
        coverPending={coverPending}
        coverError={coverError}
        onChooseCover={onChooseCover}
        onRemoveCover={onRemoveCover}
        onRetryCover={onRetryCover}
      />
      {!canStart && startHint ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>{startHint}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={getTranslation(es ? 'es' : 'en')('dynamicMessages.delete_602940', {
          value1: name,
        })}
        accessibilityState={{ disabled: !canDelete || busy }}
        disabled={!canDelete || busy}
        onPress={onConfirmDelete}
        style={({ pressed }) => ({
          minHeight: sizes['control-height'],
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing['space-3'],
          padding: spacing['space-4'],
          borderRadius: radii['radius-md'],
          backgroundColor: p['surface-300'],
          opacity: !canDelete || pressed ? 0.55 : 1,
        })}
      >
        <Feather name="trash-2" size={22} color={p.danger} />
        <Text style={[textStyles.body, { color: p.danger }]}>
          {getTranslation(es ? 'es' : 'en')('training.delete_1eddfa')}
        </Text>
      </Pressable>
      {!canDelete ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          {getTranslation(es ? 'es' : 'en')('training.finishOrDiscardThisRoutineSOngoing_f99ca0')}
        </Text>
      ) : null}
    </>
  );
}

function RoutineCoverActions({
  name,
  hasCover,
  busy,
  coverPending,
  coverError,
  onChooseCover,
  onRemoveCover,
  onRetryCover,
}: Pick<
  RoutineActionsMenuProps,
  | 'name'
  | 'hasCover'
  | 'coverPending'
  | 'coverError'
  | 'onChooseCover'
  | 'onRemoveCover'
  | 'onRetryCover'
> &
  Readonly<{ busy: boolean }>) {
  const p = usePalette();
  const es = useLanguage() === 'es';
  return (
    <>
      {' '}
      <View
        style={{
          backgroundColor: p['surface-300'],
          borderRadius: radii['radius-lg'],
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${hasCover ? 'Change' : 'Add'} cover for ${name}`}
          accessibilityState={{ disabled: busy, busy: coverPending }}
          disabled={busy}
          onPress={onChooseCover}
          style={({ pressed }) => ({
            minHeight: sizes['control-height'],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['space-3'],
            padding: spacing['space-4'],
            opacity: busy || pressed ? 0.55 : 1,
          })}
        >
          <Feather name="image" size={22} color={p.ink} />
          <Text style={[textStyles.body, { color: p.ink }]}>
            {hasCover
              ? getTranslation(es ? 'es' : 'en')('training.changeCover_defe3e')
              : getTranslation(es ? 'es' : 'en')('training.addCover_4bffa4')}
          </Text>
          {coverPending ? (
            <ActivityIndicator
              accessibilityLabel={getTranslation(es ? 'es' : 'en')('training.updatingCover_dd98d7')}
              color={p.brand}
            />
          ) : null}
        </Pressable>
        {hasCover ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getTranslation(es ? 'es' : 'en')(
              'dynamicMessages.removeCoverFor_e79cf7',
              { value1: name },
            )}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onRemoveCover}
            style={({ pressed }) => ({
              minHeight: sizes['control-height'],
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing['space-3'],
              padding: spacing['space-4'],
              opacity: busy || pressed ? 0.55 : 1,
            })}
          >
            <Feather name="trash-2" size={22} color={p.danger} />
            <Text style={[textStyles.body, { color: p.danger }]}>
              {getTranslation(es ? 'es' : 'en')('training.removeCover_bba977')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {coverError ? (
        <View style={{ gap: spacing['space-2'] }}>
          <Text accessibilityRole="alert" style={[textStyles['body-sm'], { color: p.danger }]}>
            {coverError}
          </Text>
          {onRetryCover ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={getTranslation(es ? 'es' : 'en')(
                'training.retryCoverUpload_8775b7',
              )}
              disabled={busy}
              onPress={onRetryCover}
              style={{ minHeight: sizes['tap-min'], justifyContent: 'center' }}
            >
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>
                {getTranslation(es ? 'es' : 'en')('training.retry_95b6f5')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
