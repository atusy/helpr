import type { HeadersFunction } from "@remix-run/node";

export const headers: HeadersFunction = () => ({
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
});

export default function FuzzyHelp() {
  return (
    <div id="fuzzyhelp">
      <h1>FuzzyHelp</h1>
    </div>
  )
}
