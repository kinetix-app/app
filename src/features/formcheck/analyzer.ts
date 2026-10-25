import type { FormCheckProfile } from './profiles';
import type { FormAnalysis, Recording } from './schemas';

/**
 * Turns a recording into a result. A real implementation reads the video; the app only depends
 * on this contract, so swapping it never touches the screens.
 */
export interface FormAnalyzer {
  /** True while results are placeholders, so screens can say so. */
  readonly isDemo: boolean;
  analyze(input: {
    profile: FormCheckProfile;
    recording: Recording;
    signal?: AbortSignal;
  }): Promise<FormAnalysis>;
}
