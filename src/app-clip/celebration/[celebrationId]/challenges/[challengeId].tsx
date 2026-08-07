/**
 * App Clip route — challenge detail
 *
 * Re-exports the shared guest screen. Only this module and its own imports
 * enter the Clip bundle; sibling host routes in `src/app` are not reachable
 * from here because `require.context` walks `src/app-clip` only.
 */
export { default } from '../../../../app/celebration/[celebrationId]/challenges/[challengeId]';
