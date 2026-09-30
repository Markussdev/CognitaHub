## Inspiration

Cognita Hub started with a simple question:

**What if educational technology supported the people who know the child instead of trying to replace them?**

While developing Cognita, we talked with educators and researchers and learned that a learning activity is much more than a question and a correct answer.

Instructions, support, engagement, context and human observation all matter.

Cognita Hub was created to support mathematics learning for children aged **5–9**, initially focusing on children who may benefit from more accessible and configurable learning experiences.

---

## What it does

Cognita Hub is an educational ecosystem connecting **children, mediators, families and schools**.

### For children
- Interactive mathematics learning journeys
- Accessible and configurable experiences
- A dedicated Android interface designed around exploration rather than dashboards

### For mediators
- Activity preparation
- Session management
- Observation records
- Context about how the child interacted with each experience

### For families
- Accessible summaries of learning sessions
- A clearer view of the child's learning journey

Instead of reducing learning to a score, Cognita preserves the context around each session:

**What support was needed? How did the child participate? What did the mediator observe? What could be tried next?**

For Shipaton, we also developed **Cognita Escola**, our institutional licensing concept powered by RevenueCat.

Schools can unlock institutional access through a RevenueCat purchase flow while the child's learning experience remains free from ads and child-facing monetization.

---

## How we built it

Cognita combines a web ecosystem for adults with a dedicated Android experience for children.

### Web
- Vanilla JavaScript
- CSS
- Vite
- Supabase

### Android
- Vanilla JavaScript
- Vite
- Capacitor 8
- Supabase
- RevenueCat Purchases SDK

Supabase powers our PostgreSQL database, authentication, Row Level Security, storage and shared learning records.

For Shipaton, we integrated the **RevenueCat Purchases SDK** into our Capacitor Android application.

Our institutional prototype uses:

- Offering: `cognita_school`
- Monthly package: `$rc_monthly`
- Product: `cognita_school_pilot_monthly`
- Entitlement: `school_access`

We validated the RevenueCat Test Store flow on a **physical Android device**, including:

- Successful purchase
- Failed purchase
- Cancellation
- `school_access` entitlement activation

The current purchase flow is a sandbox prototype and does not represent validated commercial pricing.

---

## Challenges we ran into

One of our biggest challenges was designing for three very different perspectives at the same time: the child learning, the adult mediating and the family following the process.

We also learned that there is no universal **"accessible mode."**

An animation, visual stimulus or instruction style that helps one child may create friction for another. Because of that, Cognita focuses on **configurable experiences rather than prescribing one interface based on a diagnosis.**

On the technical side, moving from a web-first ecosystem to Android with Capacitor forced us to rethink:

- Navigation
- Native application lifecycle
- Mobile performance
- Initialization
- Touch interactions
- Animations

RevenueCat also created an interesting product challenge: **how do we monetize Cognita without putting accessibility behind a child's paywall?**

Our answer was to explore institutional licensing through Cognita Escola.

---

## Accomplishments that we're proud of

We're proud that Cognita is no longer just an idea.

Today, the prototype includes:

- A working Android child application
- Web experiences for mediators and families
- Device pairing
- Interactive mathematics activities
- Learning journeys
- Configurable experience settings
- Session and observation records
- Family feedback
- RevenueCat integration
- An institutional licensing prototype

We are especially proud of successfully validating the RevenueCat purchase lifecycle on a real Android device.

But our biggest accomplishment was changing the way we thought about the product itself.

Cognita evolved from **"a platform with math exercises"** into a learning cycle built around human mediation:

**Know → Adapt → Mediate → Observe → Learn → Repeat**

---

## What we learned

We learned that educational technology does not need to automate every pedagogical decision to be useful.

A correct answer alone does not describe a learning experience.

**Context matters.**

Human observation, engagement, support and the way the child experienced an activity can all contribute meaningful information.

We also learned that monetization is not just a technical integration.

RevenueCat pushed us to think about **who should actually pay for the product**, which led us toward an institutional model rather than monetizing the child's experience directly.

And technically, testing on a physical Android device reminded us very quickly that:

**"It works in the browser" does not mean "the mobile app is finished."** 

---

## What's next for Cognita Hub

Our next step is to expand Cognita with more **multimodal learning experiences**, including richer visual and auditory interactions.

We also want to improve:

- Immediate activity exploration
- Accessibility configuration
- Mediator observations
- Connections between one session and the next
- Institutional tools for schools

Cognita Escola can evolve from our current RevenueCat Test Store prototype into a real licensing model for schools and educational organizations.

Our long-term goal remains simple:

**Technology should support the people who know the child  not pretend to replace them.**