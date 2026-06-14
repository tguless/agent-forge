# Skill: SaaS Access Grid (Least Privilege)

When forging an agent that belongs to a business, you also provision its **access grid**: which apps from the business's selected stack the agent needs, and at what **capacity** (access level).

## Principles

- **Least privilege.** Grant the minimum capacity that lets the agent do its job. Prefer `viewer` over `editor`, `editor` over `admin`, and never `owner`/`billing_admin` unless the role is explicitly executive/administrative.
- **Only selected apps.** You may only grant access to apps in the business's **selected** stack (provided to you). Do not invent apps here.
- **Only valid capacities.** Each app has a fixed set of allowed capacities (its type's subset of the controlled vocabulary). Use only those; the tool rejects anything else.
- **Justify each grant.** Every capacity gets a one-line `rationale` tied to a concrete task the agent performs.

## How to grant (`set_app_access`)

- Pass an `items` array; each item is `{ app, capacity, rationale }`.
- `app` is the app name or slug from the provided selected stack.
- `capacity` is a controlled capacity key valid for that app's type.
- Grant several capacities across the 2–5 apps the role actually touches — not every app in the stack.

## Examples of good mapping

- An **AP Automation Agent** → accounting `editor` (post invoices), storage `viewer` (read source PDFs), email `send` (vendor queries). Not accounting `owner`.
- A **Compliance/QA Agent** → CRM `viewer`, docs `viewer`, accounting `audit`. Read-heavy, no write.
- An **Operations Lead (authority 4–5)** → broader `admin`/`configure` on the 1–2 systems it governs, `viewer` elsewhere.

Grant access after the agent's identity and lists are set, before `finalize`.
