import { createFileRoute } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { NoPermission, PageHeader, Section } from "@/components/rosy/primitives";
import { RosyConversation } from "@/components/rosy/rosy-panel";

export const Route = createFileRoute("/_authenticated/rosy-bot")({
  head: () => ({
    meta: [
      { title: "Rosy bot — Rosy AI" },
      {
        name: "description",
        content:
          "Ask questions about performance, menu, stock, guests, renewals and holdings — answered inside your own permissions with the evidence attached.",
      },
      { property: "og:title", content: "Rosy bot — Rosy AI" },
      { property: "og:description", content: "Answers inside your permissions, with evidence attached." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Bot,
});

function Bot() {
  const { data: access } = useAccess();
  const allowed = access?.permissions.includes("use_bot") ?? false;

  if (access && !allowed) return <NoPermission what="Rosy bot" />;

  return (
    <>
      <PageHeader
        title="Rosy bot"
        intro="Rosy bot answers from the same figures, definitions and permissions as the dashboards. It calculates with fixed, reviewed queries — never by inventing numbers — and tells you what it could not answer."
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Section title="Conversation" description="Answers respect the current period and venue filters.">
          <RosyConversation access={access} />
        </Section>

        <Section title="What Rosy bot will and will not do" description="No hidden capabilities.">
          <ul className="space-y-3 text-sm">
            <li>
              <span className="font-medium">Answers only what you may see.</span> It uses your grants, so a
              venue or investor record outside your access stays invisible — including in aggregates.
            </li>
            <li>
              <span className="font-medium">Uses reviewed calculations.</span> Every figure comes from the
              platform's shared metric definitions, so a number here matches the same number on a page.
            </li>
            <li>
              <span className="font-medium">Refuses sensitive requests.</span> Salary, payroll, passport and
              bank details are not available to it at all.
            </li>
            <li>
              <span className="font-medium">Takes no action.</span> It cannot send a message, place an order,
              file a renewal, approve a valuation or change anyone's access.
            </li>
            <li>
              <span className="font-medium">Says when it doesn't know.</span> Missing sources produce "not
              available", never a plausible-looking guess.
            </li>
          </ul>
        </Section>
      </div>
    </>
  );
}
