import { ArrowUpRight, ChevronDown, CodeXml } from "lucide-react";

const repository = "https://github.com/helopony/embedded-app-demo/tree/main";

const projects = [
  {
    name: "Admin app",
    folder: "apps/admin",
    description: "Shows who is signed in, embeds the forecast, and renders the partner’s sidebar links. Its server signs launch assertions and serves the sales API.",
  },
  {
    name: "Partner app",
    folder: "apps/partner",
    description: "Hosts the forecast on its own domain. Its server exchanges the admin’s signed assertion for an access token and uses it to read sales.",
  },
  {
    name: "Bridge library",
    folder: "packages/bridge",
    description: "Connects the admin and iframe through postMessage. It checks who sent each message and carries menu updates, route changes, and assertion requests.",
  },
  {
    name: "UI library",
    folder: "packages/ui",
    description: "Provides the buttons, cards, badges, and styles that both apps use.",
  },
];

export function ProjectGuide() {
  return (
    <details open className="group mb-4 rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden">
        <CodeXml aria-hidden size={16} className="text-emerald-700" />
        Apps and libraries
        <ChevronDown aria-hidden size={16} className="ml-auto text-slate-500 group-open:rotate-180" />
      </summary>
      <dl className="grid gap-5 border-t border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {projects.map(({ name, folder, description }) => (
          <div key={folder}>
            <dt className="text-sm font-semibold">{name}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-600">
              <p>{description}</p>
              <a href={`${repository}/${folder}`} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-emerald-800 underline underline-offset-2">
                {folder}<span className="sr-only"> on GitHub (opens in a new tab)</span><ArrowUpRight aria-hidden size={13} />
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
