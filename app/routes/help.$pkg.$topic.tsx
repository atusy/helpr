import type { LoaderFunctionArgs } from "@remix-run/node";
import { useOutletContext } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  useLoaderData,
} from "@remix-run/react";
import { FzfResultItem } from "fzf";
import invariant from "tiny-invariant";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.pkg, "Missing pkg param");
  invariant(params.topic, "Missing topic param");
  return json({ pkg: params.pkg, topic: params.topic })
}

export default function Help() {
  const { pkg, topic } = useLoaderData<typeof loader>();
  const ctx = useOutletContext();
  const toc = ctx.toc as FzfResultItem<Record<string, string>>[]
  const webR = ctx.webR
  return (
    <div id="contact">
      <p>
        {
          toc.map(({ item }) => {
            if (item.pkg === pkg && item.topic === topic) {
              return item.title
            }
            return ""
          })
        }
      </p>
    </div>
  );
}
