import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Links,
  Meta,
  NavLink,
  Outlet,
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

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  await webR.init();
  const result = await webR.evalR(`
    db <- utils::hsearch_db()
    as.list(db$Aliases[
      db$Aliases$ID %in% db$Base$ID[db$Base$Type == "help"],
      c("Alias", "Package")
    ])
  `);
  const helpData = await result.toJs();
  const topic = helpData.values[0].values as string[]
  const pkg = helpData.values[1].values as string[]

  const tick = (x: string) => "`" + x + "`"
  const toc = topic.map((v, i) => {
    return { name: `${pkg[i]}::${v.match(/^[.a-zA-Z]/) ? v : tick(v)}`, topic: v, pkg: pkg[i] }
  })

  const fzf = new Fzf(toc, { selector: (item) => item.name })
  const entries = fzf.find(q ?? "")

  return json({ toc: entries, q });
};

export default function App() {
  const { toc, q } = useLoaderData<typeof loader>();
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
                aria-label="Search contacts"
                className={searching ? "loading" : ""}
                defaultValue={q || ""}
                placeholder="Search"
                type="search"
                name="q"
              />
              <div
                id="search-spinner"
                hidden={!searching}
                aria-hidden
              />
            </Form>
          </div>
          <nav>
            {toc.length ? (
              <ul>
                {toc.map(({ item }) => (
                  <li key={item.name}>
                    <NavLink
                      to={
                        `help/${encodeURIComponent(item.pkg)
                        }/${encodeURIComponent(item.topic)
                        }${q != null ? "?q=" + q : ""}`
                      }
                      className={({ isActive, isPending }) =>
                        isActive ? "active" : isPending ? "pending" : ""
                      }
                    >
                      {item.name}
                    </NavLink>
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
          <Outlet context={{ toc, webR }} />
        </div>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html >
  );
}
