import type { HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { WebR } from 'webr';

export const headers: HeadersFunction = () => ({
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
});

const webR = new WebR();

export const action = async () => {
  await webR.init();
  const result = await webR.evalR('rnorm(3)')
  const output = await result?.toArray()
  if (Array.isArray(output)) {
    return json({ values: output })
  }
  throw new Response("Bad Request", { status: 400 });
}

export default function FuzzyHelp() {
  const resp = useActionData<typeof action>()
  const values = resp?.values ?? []
  return (
    <div id="fuzzyhelp">
      <h1>FuzzyHelp</h1>
      <Form method="post">
        <button type="submit">webr</button>
        <p>{values.length > 0 ? `${values[1]}` : "not yet"}</p>
      </Form>
    </div>
  )
}
