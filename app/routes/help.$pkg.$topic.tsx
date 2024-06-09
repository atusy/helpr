import "./help.css"
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useOutletContext } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  useLoaderData,
} from "@remix-run/react";
import { FzfResultItem } from "fzf";
import invariant from "tiny-invariant";
import { WebR } from 'webr';

let webR = new WebR();

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.pkg, "Missing pkg param");
  invariant(params.topic, "Missing topic param");
  await webR.init();
  const { topic, pkg } = params
  const shelter = await new webR.Shelter();
  const tick = "`"
  const result = await shelter.captureR(`
    x <- help(${tick}${topic}${tick}, package = ${pkg}, help_type = "html")
    paths <- as.character(x)
    file <- paths[1L]
    pkgname <- basename(dirname(dirname(file)))
    try({
      helpfile <- utils:::.getHelpFile(file)
      tools::Rd2HTML(helpfile, package = pkgname)
    }, silent = TRUE)
  `);
  const help = result.output;
  shelter.purge()
  return json({ help })
}

export default function Help() {
  const { help } = useLoaderData<typeof loader>();
  const ctx = useOutletContext() as {
    toc: FzfResultItem<Record<string, string>>[]
    webR: WebR
  };
  webR = webR // somehow, error happens without this...
  webR = ctx.webR
  return (
    <iframe
      srcDoc={help.map((x) => x.data).join("\n")}
      id="helpContent"
    ></iframe>
  );
}
