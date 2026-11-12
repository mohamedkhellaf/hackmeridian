// The welcome guide: four short notes, each beside the control it explains, shown when the visitor asks.
// `src/app/GuideMount.tsx` loads this chunk the first time a guide is asked for. Only `GuideHost` is public; the
// shell, the Markets page and the asset page never import this folder: they ask through `useGuide()` (src/data).
export { GuideHost } from './Guide'
