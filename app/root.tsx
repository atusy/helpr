import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { useEffect } from "react";
import { WebR } from 'webr';
import { Fzf } from "fzf";

import appStylesHref from "./app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
];

const webR = new WebR();
const attemptedPackages = new Set()

const getHelp = async (pkg: string | null, topic: string | null): Promise<string> => {
  const tick = "`";
  const help = (pkg != null && pkg !== "" && topic != null && topic !== "")
    ? `help(${tick}${topic}${tick}, package = ${pkg}, help_type="html")`
    : `help()`
  const shelter = await new webR.Shelter();
  const result = await shelter.captureR(`
    x <- ${help}
    paths <- as.character(x)
    file <- paths[1L]
    pkgname <- basename(dirname(dirname(file)))
    try({
      helpfile <- utils:::.getHelpFile(file)
      tools::Rd2HTML(helpfile, package = pkgname)
    }, silent = TRUE)
  `);
  const content = result.output;
  shelter.purge();
  return content.map((x) => x.data).join("\n");
}

const installPackageFromQ = async (q: string | null) => {
  const maybePkg = q?.match(/^[^\s:]+::/)
  if (maybePkg) {
    await webR.installPackages([maybePkg[0].slice(0, -2)])
  }
}

const installPackageFromPkg = async (pkg: string | null) => {
  if (pkg != null && pkg !== "" && !attemptedPackages.has(pkg)) {
    attemptedPackages.add(pkg)
    await webR.installPackages([pkg])
  }
}

const getTopics = async (q: string | null) => {
  const result = await webR.evalR(`
    db <- utils::hsearch_db()
    as.list(db$Aliases[
      db$Aliases$ID %in% db$Base$ID[db$Base$Type == "help"],
      c("Alias", "Package")
    ])
  `);
  const helpData = await result.toJs();
  const topics = helpData.values[0].values as string[]
  const pkgs = helpData.values[1].values as string[]

  pkgs.map((p) => attemptedPackages.add(p));

  const tick = (x: string) => "`" + x + "`"
  const entries = topics.map((v, i) => {
    return { name: `${pkgs[i]}::${v.match(/^[.a-zA-Z]/) ? v : tick(v)}`, topic: v, pkg: pkgs[i] }
  })

  const fzf = new Fzf(entries, { selector: (item) => item.name })

  return fzf.find(q ?? "")
}

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  await webR.init();

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const pkg = url.searchParams.get("pkg");
  const topic = url.searchParams.get("topic");

  await installPackageFromQ(q)
  await installPackageFromPkg(pkg)

  const content = await getHelp(pkg, topic)

  const entries = await getTopics(q)

  return json({ entries, q, pkg, topic, content });
};

export default function App() {
  const { entries, q, pkg, topic, content } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has(
      "q"
    );

  useEffect(() => {
    const searchField = document.getElementById("q");
    if (searchField instanceof HTMLInputElement) {
      searchField.value = q || "";
    }
  }, [q]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div
          className={
            navigation.state === "loading" && !searching
              ? "loading" : ""
          }
          id="sidebar"
        >
          <h1>Remix Contacts</h1>
          <div>
            <Form
              id="search-form"
              onChange={(event) => {
                const isFirstSearch = q === null;
                submit(event.currentTarget, {
                  replace: !isFirstSearch
                })
              }}
              role="search"
            >
              <input
                id="q"
                name="q"
                aria-label="Search contacts"
                className={searching ? "loading" : ""}
                defaultValue={q || ""}
                placeholder="Search"
                type="search"
              />
              <div
                id="search-spinner"
                hidden={!searching}
                aria-hidden
              />
              <input id="pkg" name="pkg" defaultValue={pkg || ""} />
              <input id="topic" name="topic" defaultValue={topic || ""} />
            </Form>
          </div>
          <nav id="helpTopics">
            {toc.length ? (
              <ul>
                {toc.map(({ item }) => (
                  <li key={item.name}>
                    <Form
                      onClick={(event) => {
                        document.getElementById(encodeURIComponent(item.name)).value =
                          document.getElementById("q").value;
                        submit(event.currentTarget, { replace: true })
                      }}
                    >
                      <a className={(pkg === item.pkg && topic === item.topic) ? "active" : ""}>{item.name}</a>
                      <input name="q" id={encodeURIComponent(item.name)} />
                      <input name="pkg" defaultValue={item.pkg} />
                      <input name="topic" defaultValue={item.topic} />
                    </Form>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                <i>No contacts</i>
              </p>
            )}
          </nav>
        </div>
        <div id="detail">
          <iframe id="helpContent" srcDoc={content}></iframe>
        </div>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html >
  );
}
