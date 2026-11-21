import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Whatever is running the creation steps, when it is not the `/create` routes.
 *
 * In the app each step is a route, and moving on is a navigation. The web form
 * shows the same step screens one at a time inside a single page, so it
 * supplies this instead and the steps ask it to move rather than the router.
 * With no host, which is every case in the app, nothing changes.
 */
export interface CreationFlowHost {
  /** Moves on from the step being shown. */
  goNext: () => void;
  /** Goes back from the step being shown. */
  goBack: () => void;
  /** The canvas behind each step, when it is not the app's own. */
  backgroundColor?: string;
  /** Chooses a cover photo, where the device's photo picker is not the way. */
  pickCover?: () => void;
  /**
   * How wide a step is drawn, when it is not the whole window. On a desktop
   * the step sits in a column, and pieces sized from the window would be
   * sized for a screen several times wider than the one they are in.
   */
  width?: number;
  /**
   * `page` when the host draws the page around each step itself: the progress,
   * Back and Continue. The step then shows only its question and its control,
   * with the host's one line of why beneath the question.
   */
  chrome?: 'page';
  /** That line, in page chrome. */
  supporting?: string;
}

export const CreationFlowHostContext = createContext<CreationFlowHost | null>(null);

export function useCreationFlowHost(): CreationFlowHost | null {
  return useContext(CreationFlowHostContext);
}

/** The width a step is drawn at: the window's, unless a host says otherwise. */
export function useStepWidth(): number {
  const { width } = useWindowDimensions();
  return useContext(CreationFlowHostContext)?.width ?? width;
}
