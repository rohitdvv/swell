# Swell — Strategy (October 2026)

## The market moved in 2026

- **Toast** launched **Toast IQ Grow** (May 2026): an AI marketing agent plus a human success
  manager, **$499/month**. Its headline "8% sales lift" is Toast's own controlled study of 144 beta
  restaurants; typical before/after gains were reported at 6%, and the "40%" figure is the top
  quartile only. Not independently verified.
  ([Toast newsroom](https://pos.toasttab.com/news/toast-debuts-toast-iq-grow-spring-release-2026),
  [Toast IQ Grow](https://pos.toasttab.com/products/toast-iq-grow))
- **Square** put **Managerbot** — recommendations on marketing, staffing and inventory, owner
  approves — into open beta (April 2026), and Popmenu sells AI marketing to Square restaurants.
  ([Shopifreaks](https://www.shopifreaks.com/square-opens-managerbot-ai-business-agent-to-broader-group-of-sellers-in-open-beta-inside-square-dashboard/),
  [QSR Magazine](https://www.qsrmagazine.com/news/square-debuts-managerbot-to-automate-small-business-operations/),
  [FSR Magazine](https://www.fsrmagazine.com/industry-news/popmenu-to-brings-ai-marketing-and-ai-phone-answering-to-square-customers/))
- Labor is the largest controllable cost: a median **36.5% of sales** at full-service restaurants
  (NRA Operations Data Abstract, FY2024 data, as cited by
  [Beancount](https://beancount.io/blog/2026/07/22/restaurant-labor-cost-percentage-tracking-control-guide)).

**Implication.** "AI that writes your promotions" is now a free feature of every POS. Competing on
it is a losing race against companies that own the data pipe. What none of them can be is
**independent**: each grades its own homework, and each only works inside its own POS.

## Positioning: the independent referee for restaurant marketing

> *Is your marketing working? Your register knows.*

Swell checks **any** campaign — its own, a POS vendor's agent, an agency's, a flyer — against what
the restaurant's own sales would have been without it, using a model trained only on the days
before. It works across Toast, Square and Clover exports. And it charges only when the answer is
yes. The proof engine is the product; campaigns, posters and staffing are what we sell on top.

## What we changed (and why each founder would)

| Move | Shipped | The principle |
| --- | --- | --- |
| **Free 60-second audit, no sign-up** (`/audit`) — "find my money" (labor + slow hours as profit) and "did my marketing work?" for any campaign | ✅ | *Bezos*: work backwards from the customer — show them their money first. *Jobs*: one magical first minute. *Musk*: delete the sign-up step. |
| **Reposition** around independence; drop the "OS" sub-brand; one promise | ✅ | *Jobs*: say one thing. |
| **Pay for proof** ($0/month, share of proven lift, cautious end, capped) as the hero offer, Starter ($49) retired | ✅ (earlier) / ✅ | *Bezos*: remove the customer's risk; *Jobs*: fewer choices. |
| **Founding 100**: 10% for life, live counter of real spots | ✅ | *Musk*: urgency — but only real urgency. |
| **Public accuracy record** recomputed in CI (`/accuracy`) | ✅ (earlier) | Trust is the moat for a referee. |
| **Founder dashboard + lead capture** (`/admin`, "book a walkthrough") | ✅ | *Bezos*: metrics; *every founder*: do things that don't scale — call the first 100 owners. |
| **Referral loop**: give $100, get $100 — earned only when the referred register proves a campaign | ✅ | *Bezos*: a flywheel where every proven result recruits the next restaurant; paying for results, not sign-ups, keeps it honest. |

## The model

- **Free**: audit + 1 campaign/month.
- **Pay for proof** (default): 15% of the cautious end of each proven lift, ≤ $1,500/month;
  10% for life for the first 100 accounts.
- **Pro** $149/month flat, **Agency** $399/month — for owners and groups who prefer a fixed bill.

Anchor: a POS vendor's AI marketing add-on lists at $499/month whether it works or not.

## The next 90 days

1. **Founder-led sales.** Share `/audit` with 100 independent restaurants in one city; call every
   lead the day it arrives (`/admin`). Goal: 10 pay-for-proof accounts, 3 proven results.
2. **Publish the first real proof** on `/accuracy` (automatic once 3 campaigns are measured).
3. **Agencies as a channel**: an agency that can *prove* results to its clients wins renewals —
   offer Proof reports to them.
4. **Remove the CSV**: Square's Orders API is open to third-party apps via OAuth — build
   "Connect Square" so Proof runs every month with no upload. Toast partner application in parallel.

## Metrics that matter

Audits run → leads → campaigns built → proof uploads → **proven results** → invoiced dollars.
Everything else is vanity.
