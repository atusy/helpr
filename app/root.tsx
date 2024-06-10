import type { LinksFunction } from "@remix-run/node";
import {
  Form,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { WebR, ChannelType } from 'webr';
import { Fzf, FzfResultItem, byLengthAsc, byStartAsc } from "fzf";

import appStylesHref from "./app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
];

const webR = new WebR({ channelType: ChannelType.PostMessage });
const attemptedPackages = new Set()

const getHelp = async (pkg: string | null, topic: string | null): Promise<string> => {
  const tick = "`";
  const help = (pkg != null && pkg !== "" && topic != null && topic !== "")
    ? `help(${tick}${topic}${tick}, package = ${pkg}, help_type="html")`
    : `help()`;
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
  const maybePkg = q?.match(/^[^\s:]+::/);
  if (maybePkg != null && maybePkg.length > 0 && !attemptedPackages.has(maybePkg)) {
    attemptedPackages.add(maybePkg);
    await webR.installPackages([maybePkg[0].slice(0, -2)]);
  }
  return maybePkg;
}

const installPackageFromPkg = async (pkg: string | null) => {
  if (pkg != null && pkg !== "" && !attemptedPackages.has(pkg)) {
    attemptedPackages.add(pkg);
    await webR.installPackages([pkg]);
  }
}

const getEntries = async () => {
  const result = await webR.evalR(`
    db <- utils::hsearch_db()
    as.list(db$Aliases[
      db$Aliases$ID %in% db$Base$ID[db$Base$Type == "help"],
      c("Alias", "Package")
    ])
  `);
  const helpData = await result.toJs();
  const topics = helpData.values[0].values as string[];
  const pkgs = helpData.values[1].values as string[];

  pkgs.map((p) => attemptedPackages.add(p));

  const tick = (x: string) => "`" + x + "`";
  const entries = topics.map((v, i) => {
    return { name: `${pkgs[i]}::${v.match(/^[.a-zA-Z]/) ? v : tick(v)}`, topic: v, pkg: pkgs[i] };
  })
  return entries;
}

const filterEntries = (entries: { name: string; topic: string; pkg: string }[], q: string | null) => {
  const fzf = new Fzf(entries, { selector: (item) => item.name, tiebreakers: [byStartAsc, byLengthAsc,] });
  const found = fzf.find(q ?? "");
  return found;
}

export default function App() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const q0 = params.get("q");
  const [filtered, setFiltered] = useState<FzfResultItem<{ name: string; topic: string; pkg: string }>[]>([]);
  const [entries, setEntries] = useState<{ name: string; topic: string; pkg: string }[]>([]);
  const [q, setQ] = useState(q0);
  const [n, setN] = useState(attemptedPackages.size);
  const [pkg, setPkg] = useState(params.get("pkg"));
  const [topic, setTopic] = useState(params.get("topic"));
  const [content, setContent] = useState("");

  const navigation = useNavigation();
  const submit = useSubmit();
  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has("q");

  useEffect(() => {
    (async () => {
      await webR.init();
      const entries = await getEntries();
      setEntries(entries);
      setFiltered(filterEntries(entries, q));
    })();
  }, []);
  useEffect(() => {
    (async () => {
      await webR.init();
      await installPackageFromPkg(pkg);
      setContent(await getHelp(pkg, topic));
    })();
  }, [pkg, topic]);
  useEffect(() => {
    (async () => {
      await webR.init();
      const newEntries = await getEntries();
      if (newEntries.length > entries.length) {
        // avoid set on page load
        setEntries(newEntries);
      }
    })();
  }, [n]);
  useEffect(() => {
    (async () => {
      await webR.init();
      await installPackageFromQ(q);
      setN(attemptedPackages.size);
    })();
  }, [q]);
  useEffect(() => {
    setFiltered(filterEntries(entries, q));
  }, [entries]);

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
          className={navigation.state === "loading" && !searching ? "loading" : ""}
          id="sidebar"
        >
          <div>
            <Form
              id="search-form"
              onChange={(event) => {
                const newQ = document.getElementById("q").value;
                const isFirstSearch = newQ === null;
                setQ(newQ);
                if (newQ != null && q != null && newQ.slice(0, q.length) === q) {
                  setFiltered(filterEntries(filtered.map((x) => x.item), newQ));
                } else {
                  setFiltered(filterEntries(entries, newQ));
                }
                submit(event.currentTarget, { replace: !isFirstSearch });
              }}
              role="search"
            >
              <input
                id="q"
                name="q"
                aria-label="Search contacts"
                className={searching ? "loading" : ""}
                defaultValue={q0 || ""}
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
            {entries.length ? (
              <ul>
                {filtered.map(({ item }) => (
                  <li key={item.name} id={encodeURIComponent(item.name)}>
                    <Form
                      onClick={(event) => {
                        setPkg(item.pkg);
                        setTopic(item.topic);
                        submit(event.currentTarget, { replace: true });
                      }}
                    >
                      <a className={(pkg === item.pkg && topic === item.topic) ? "active" : ""}>{item.name}</a>
                      <input name="q" className="q" defaultValue={q || ""} />
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
