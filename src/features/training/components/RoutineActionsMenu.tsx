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
  const busy = deleting || coverPending;
  const insets = useSafeAreaInsets();
  const first = useRef<View>(null);
  const [confirming, setConfirming] = useState(false);
  const error =
    deleteError instanceof ApiError && deleteError.status === 409
      ? 'This routine has an ongoing workout. Finish or discard it before deleting.'
      : 'Could not delete the routine. Try again.';
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
          accessibilityLabel={confirming ? `Delete ${name}` : `Actions for ${name}`}
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
                {confirming ? 'Delete routine?' : name}
              </Text>
              {confirming ? (
                <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
                  This routine will be removed from your library. Completed workouts and training
                  history will be kept.
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
              accessibilityLabel={confirming ? 'Keep routine' : 'Close routine actions'}
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
                {confirming ? 'Keep routine' : 'Cancel'}
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
  return (
    <>
      {deleteError ? (
        <Text accessibilityRole="alert" style={[textStyles.body, { color: p.danger }]}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Confirm delete ${name}`}
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
          {deleting ? 'Deleting…' : 'Delete routine'}
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
    first: React.RefObject<View | null>;
    onConfirmDelete: () => void;
  }>) {
  const p = usePalette();
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
          accessibilityLabel={`Train ${name}`}
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
          <Text style={[textStyles.body, { color: p['brand-ink'] }]}>Train</Text>
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
          accessibilityLabel={`Edit ${name}`}
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
          <Text style={[textStyles.body, { color: p.ink }]}>Edit</Text>
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
        accessibilityLabel={`Delete ${name}`}
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
        <Text style={[textStyles.body, { color: p.danger }]}>Delete</Text>
      </Pressable>
      {!canDelete ? (
        <Text style={[textStyles['body-sm'], { color: p['ink-muted'] }]}>
          Finish or discard this routine’s ongoing workout before deleting.
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
            {hasCover ? 'Change cover' : 'Add cover'}
          </Text>
          {coverPending ? (
            <ActivityIndicator accessibilityLabel="Updating cover" color={p.brand} />
          ) : null}
        </Pressable>
        {hasCover ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove cover for ${name}`}
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
            <Text style={[textStyles.body, { color: p.danger }]}>Remove cover</Text>
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
              accessibilityLabel="Retry cover upload"
              disabled={busy}
              onPress={onRetryCover}
              style={{ minHeight: sizes['tap-min'], justifyContent: 'center' }}
            >
              <Text style={[textStyles.label, { color: p['brand-ink'] }]}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
