import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { formCheckProfiles, profileById, type FormCheckProfile } from '../profiles';
import type { Recording } from '../schemas';
import { buildAnalysisView } from '../view';
import { CannotAssessScreen } from './CannotAssessScreen';
import { ConsentScreen } from './ConsentScreen';
import { useFormCheck } from './FormCheckProvider';
import { RecordScreen } from './RecordScreen';
import { RecordingPlayer } from './RecordingPlayer';
import { ResultScreen } from './ResultScreen';
import { AnalysisFailedScreen, AnalyzingScreen } from './StatusScreens';

type Step = 'record' | 'analyzing' | 'result' | 'video' | 'failed';

/**
 * Full-screen journey for one set: consent (until the camera is allowed), record, analysis,
 * result and the recorded video. Closing it returns to the workout.
 */
export function FormCheckFlow({
  exerciseName,
  profile,
  setId,
  setNumber,
  onClose,
}: Readonly<{
  exerciseName: string;
  profile: FormCheckProfile;
  setId: string;
  setNumber: number;
  onClose: () => void;
}>) {
  const { analyzer, entryFor, save } = useFormCheck();
  const entry = entryFor(setId);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>(entry ? 'result' : 'record');
  const pending = useRef<Recording | null>(null);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);

  async function analyze(recording: Recording) {
    pending.current = recording;
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setStep('analyzing');
    try {
      const analysis = await analyzer.analyze({ profile, recording, signal: controller.signal });
      if (controller.signal.aborted) return;
      await save(setId, recording, analysis);
      if (!controller.signal.aborted) setStep('result');
    } catch {
      if (!controller.signal.aborted) setStep('failed');
    }
  }
  function cancelAnalysis() {
    running.current?.abort();
    setStep(entry ? 'result' : 'record');
  }
  const recordAgain = () => setStep('record');
  const leaveRecording = () => (entry ? setStep('result') : onClose());

  function content() {
    if (step === 'record') {
      if (!permission) return null;
      if (!permission.granted)
        return (
          <ConsentScreen
            supportedNames={formCheckProfiles.map((value) => value.name.toLowerCase())}
            denied={!permission.canAskAgain}
            onAllow={() => void requestPermission()}
            onOpenSettings={() => void Linking.openSettings()}
            onClose={leaveRecording}
          />
        );
      return (
        <RecordScreen
          profile={profile}
          exerciseName={exerciseName}
          setNumber={setNumber}
          onCancel={leaveRecording}
          onFinish={(recording) => void analyze(recording)}
        />
      );
    }
    if (step === 'analyzing') return <AnalyzingScreen onCancel={cancelAnalysis} />;
    if (step === 'failed')
      return (
        <AnalysisFailedScreen
          onRetry={() => pending.current && void analyze(pending.current)}
          onRecordAgain={recordAgain}
          onClose={onClose}
        />
      );
    if (!entry) return null;
    const hasVideo = Boolean(entry.recording.uri);
    if (step === 'video' && entry.recording.uri)
      return (
        <RecordingPlayer
          uri={entry.recording.uri}
          title={`${exerciseName} · set ${setNumber}`}
          onBack={() => setStep('result')}
        />
      );
    const view = buildAnalysisView(
      profileById(entry.analysis.profileId) ?? profile,
      entry.analysis,
    );
    const shared = {
      exerciseName,
      setNumber,
      isDemo: analyzer.isDemo,
      hasVideo,
      onWatchVideo: () => setStep('video'),
      onRecordAgain: recordAgain,
    };
    return view.kind === 'assessed' ? (
      <ResultScreen {...shared} view={view} onDone={onClose} />
    ) : (
      <CannotAssessScreen {...shared} view={view} onLogByHand={onClose} />
    );
  }
  let back = leaveRecording;
  if (step === 'result' || step === 'failed') back = onClose;
  else if (step === 'video') back = () => setStep('result');
  else if (step === 'analyzing') back = cancelAnalysis;
  return (
    <Modal visible animationType="slide" onRequestClose={back}>
      {content()}
    </Modal>
  );
}
