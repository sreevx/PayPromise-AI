# 💸 PayPromise AI

### AI-Powered Invoice Recovery & Payment Assurance Platform

**PayPromise AI** helps businesses deal with one of the most frustrating parts of running a business: **getting overdue invoices paid**.

Instead of simply showing which invoices are overdue, PayPromise AI looks at the invoice, customer payment history, overdue period, previous follow-ups, and promises to pay — then recommends **what should happen next and why**.

The platform brings together recovery intelligence, policy-controlled actions, customer communication, payment processing, and auditability into one workflow.

---

## 🚀 Live Demo

🌐 **[Try PayPromise AI →](https://paypromise-ai-production.up.railway.app/)**

💻 **[View the source code →](https://github.com/sreevx/PayPromise-AI)**

> The live demonstration uses synthetic/demo data and Razorpay Test Mode.

---

## 🎯 The Problem

Late payments can create serious cash-flow problems for businesses.

Finance teams often have to manually:

* Find overdue invoices
* Decide which customers to contact first
* Check previous payment behaviour
* Decide how strongly to follow up
* Track promises made by customers
* Send reminders
* Create payment links
* Check whether a payment was actually completed
* Keep records of what happened

Most invoice systems stop at:

> **"This invoice is overdue."**

PayPromise AI asks a more useful question:

> **"What should we do about this invoice, why should we do it, and did our action actually recover the payment?"**

---

# 💡 What PayPromise AI Does

PayPromise AI turns invoice recovery into a structured decision-making workflow.

```text
Invoice
   ↓
Customer & Payment History
   ↓
Recovery Analysis
   ↓
Risk & Recovery Probability
   ↓
Recommended Action
   ↓
Policy Check
   ↓
Approved Action
   ↓
Customer Follow-up
   ↓
Payment
   ↓
Payment Verification
   ↓
Invoice Recovered
```

The important part is that **AI recommendations are not executed blindly**.

Every action goes through a policy layer before it can be executed.

---

# ✨ Key Features

## 1. 📊 Invoice Intelligence

The platform gives finance teams a clearer picture of their receivables.

It tracks:

* Invoice status
* Amount due
* Days overdue
* Recovery probability
* Risk level
* Follow-up history
* Escalation level
* Recovery status

This helps teams focus their attention where it matters most.

---

## 2. 🧠 Explainable Recovery Engine

PayPromise AI doesn't just produce a recommendation.

It looks at multiple signals, including:

* Days overdue
* Customer risk score
* Average payment time
* Late-payment history
* Amount due
* Previous recovery attempts
* Promise-to-pay history
* Payment history

The engine then produces:

* Recovery probability
* Risk level
* Recommended action
* Reasoning
* Confidence score
* Suggested follow-up interval

The goal is to make the recommendation **understandable rather than mysterious**.

---

## 3. 🛡️ Policy-Controlled AI

One of the most important design decisions in PayPromise AI is the separation between:

```text
Decision → Policy → Execution
```

An AI system should not automatically perform every action it recommends — especially when money and customer communication are involved.

The policy engine can respond with:

```text
ALLOW
BLOCK
ESCALATE
```

For example:

```text
AI recommends reminder
        ↓
Policy checks invoice
        ↓
   ┌────┼────┐
 ALLOW BLOCK ESCALATE
   ↓
Execute approved action
```

This provides a guardrail between intelligent recommendations and real actions.

---

## 4. 📩 Automated Recovery Actions

Depending on the situation, the system can recommend actions such as:

* Send reminder
* Request promise to pay
* Create payment link
* Follow up on an existing promise
* Escalate the case
* Stop automated recovery

The strategy changes based on the invoice and customer context instead of treating every overdue invoice the same way.

---

## 5. 💬 Customer Communication

PayPromise AI can generate recovery messages for:

* Email
* SMS
* WhatsApp

Different situations can use different communication tones:

* Friendly
* Firm
* Urgent
* Legal

This makes the communication more appropriate to the customer's situation.

---

## 6. 🤝 Promise-to-Pay Management

Customers can make commitments to pay, and PayPromise AI keeps track of what happens afterward.

Promises can move through states such as:

```text
Active
  ↓
Fulfilled

or

Active
  ↓
Broken
  ↓
Escalation
```

This allows broken promises to influence future recovery decisions.

---

## 7. 🧾 Audit Trail

Recovery actions should be explainable after the fact.

PayPromise AI records important events such as:

* Action
* Actor
* Reason
* Policy decision
* Result
* Timestamp

This creates a traceable history of how a recovery decision was made and what happened afterward.

---

## 8. 💳 Razorpay Payment Integration

PayPromise AI integrates with **Razorpay** for the payment portion of the recovery workflow.

The integration supports:

* Payment creation
* Payment links
* Razorpay payment IDs
* Payment status tracking
* Webhook processing
* Payment verification
* Invoice recovery updates
* Idempotency checks

The hackathon/demo environment uses **Razorpay Test Mode**.

Payment flow:

```text
Overdue Invoice
      ↓
Recovery Analysis
      ↓
Payment Strategy
      ↓
Payment Link
      ↓
Customer Payment
      ↓
Razorpay
      ↓
Webhook
      ↓
Payment Verification
      ↓
Invoice Recovered
```

---

# 🧠 How the Decision Engine Works

The recovery engine follows a predictable pipeline:

```text
Collect Signals
      ↓
Calculate Risk
      ↓
Estimate Recovery Probability
      ↓
Generate Reasoning
      ↓
Select Strategy
      ↓
Apply Policy
      ↓
Execute Approved Action
      ↓
Record Result
```

This structure makes the system easier to test, understand, and improve.

Instead of having one large AI function responsible for everything, the responsibilities are separated into focused parts of the system.

---

# 🏗️ Architecture

```text
┌───────────────────────────────────────┐
│              Next.js UI               │
│                                       │
│ Dashboard │ Invoices │ Customers      │
│ Follow-ups │ Audit │ Revenue          │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│          Application / API Layer      │
│                                       │
│ Recovery │ Payments │ Webhooks        │
│ Actions   │ Promises │ Demo Controls  │
└───────────────────┬───────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌──────────────────┐  ┌─────────────────┐
│ Recovery Engine  │  │ Razorpay        │
│                  │  │ Integration     │
│ Scoring          │  │                 │
│ Reasoning        │  │ Payment Links   │
│ Strategy         │  │ Webhooks        │
│ Policy           │  │ Verification    │
│ Actions          │  │                 │
└────────┬─────────┘  └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
           ┌─────────────────┐
           │     Prisma      │
           │                 │
           │ SQLite Database │
           └─────────────────┘
```

---

# 🧰 Technology Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| Frontend        | Next.js 14                             |
| UI              | React                                  |
| Styling         | Tailwind CSS                           |
| Language        | TypeScript                             |
| Backend         | Next.js server-side logic & API routes |
| ORM             | Prisma                                 |
| Database        | SQLite                                 |
| Payments        | Razorpay                               |
| Testing         | TypeScript + tsx                       |
| Deployment      | Railway                                |
| Package Manager | npm                                    |

---

# 📁 Project Structure

```text
PayPromise-AI/
│
├── __tests__/
│   └── engine.test.ts
│
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── audit/
│   │   ├── customers/
│   │   ├── follow-ups/
│   │   ├── invoices/
│   │   ├── revenue/
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── DemoBanner.tsx
│   │   └── Sidebar.tsx
│   │
│   └── lib/
│       ├── engine/
│       │   ├── actions.ts
│       │   ├── followup.ts
│       │   ├── index.ts
│       │   ├── messages.ts
│       │   ├── orchestrator.ts
│       │   ├── payments.ts
│       │   ├── policy.ts
│       │   ├── promises.ts
│       │   ├── reasoning.ts
│       │   ├── scoring.ts
│       │   ├── strategy.ts
│       │   └── types.ts
│       │
│       ├── prisma.ts
│       ├── razorpay.ts
│       └── utils.ts
│
├── package.json
├── package-lock.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

# 🧪 Testing

The core business logic has been tested across the recovery pipeline.

The test suite covers:

* Scoring Engine
* Strategy Engine
* Policy Engine
* Message Generation
* Orchestrator
* Action Execution
* Promise-to-Pay validation
* Escalation logic
* Payment logic
* AI reasoning provider
* Razorpay integration
* Idempotency
* Webhook validation
* Recovery scenarios
* Guardrail scenarios
* High-risk escalation scenarios

### Current result

```text
104 tests
104 passing
0 failing
```

Run the tests with:

```bash
npm test
```

---

# ⚙️ Run Locally

## 1. Clone the repository

```bash
git clone https://github.com/sreevx/PayPromise-AI.git
cd PayPromise-AI
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create a `.env` file:

```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Never commit `.env` or API secrets to GitHub.

## 4. Generate Prisma Client

```bash
npx prisma generate
```

## 5. Set up the database

For a fresh local development database:

```bash
npx prisma db push
```

## 6. Seed demonstration data

```bash
npm run db:seed
```

(The npm script runs the TypeScript seed directly via `tsx`.)

## 7. Start the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

# 🔄 Reset Demo Data

For local development, the database can be reset and seeded again using the project's configured reset command:

```bash
npm run db:reset
```

> Be careful with reset commands because existing local database data will be removed.

---

# 💳 Razorpay Setup

PayPromise AI uses Razorpay Test Mode for the demonstration.

Required environment variables:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Webhook endpoint:

```text
/api/webhooks/razorpay
```

Payment synchronization endpoint:

```text
/api/sync-payment
```

The application also includes payment idempotency checks to help prevent duplicate active payment creation.

For a real production deployment, additional controls such as authentication, secure secret storage, monitoring, rate limiting, retry handling, and production database infrastructure would be required.

---

# 🚂 Deployment

The current live version is deployed on **Railway**.

🌐 **Live application:**

https://paypromise-ai-production.up.railway.app/

The deployment uses Prisma migrations so that the application database schema can be created during deployment.

The demonstration database is populated with synthetic data for the live demo.

---

# 🎬 Suggested Demo Flow

If you're presenting PayPromise AI, this is the flow I'd recommend:

```text
Dashboard
   ↓
Choose an overdue invoice
   ↓
Open recovery analysis
   ↓
Show risk & recovery probability
   ↓
Explain the recommendation
   ↓
Show the policy decision
   ↓
Execute the approved action
   ↓
Show generated customer message
   ↓
Open audit trail
   ↓
Create / use payment link
   ↓
Complete payment in Test Mode
   ↓
Show payment verification
   ↓
Invoice becomes recovered
```

This demonstrates the complete journey rather than showing isolated features.

---

# 🔐 Security & Safety

PayPromise AI treats financial automation as something that needs boundaries.

The system therefore separates:

```text
AI Decision
     ↓
Policy Validation
     ↓
Action Execution
```

Additional safeguards implemented in the project include:

* Payment idempotency
* Webhook signature validation
* Invoice status validation
* Amount validation
* Duplicate payment prevention
* Automated-action limits
* Escalation rules
* Paid-invoice protection
* Written-off invoice protection
* Contact-frequency checks
* Audit logging

The repository also excludes sensitive files such as:

* `.env`
* API secrets
* `node_modules`
* Local build output
* Local project metadata

---

# ⚠️ Current Limitations

PayPromise AI is a hackathon/demo project, so there are some deliberate limitations.

### Payment environment

Razorpay is demonstrated using **Test Mode** rather than real financial transactions.

### Communication

The application generates and manages recovery messages, but production-grade delivery infrastructure for email, SMS, and WhatsApp would need to be connected separately.

### Recovery intelligence

The core recovery engine is structured and deterministic, with AI reasoning capabilities layered around it. It is **not presented as a trained machine-learning model with production performance claims**.

### Database

SQLite is used for the current demonstration environment.

### Authentication

A production deployment would require stronger authentication, authorization, and role management.

---

# 🚀 Future Scope

There are several directions in which PayPromise AI could grow.

### Smarter Recovery

* Learn from historical payment outcomes
* Improve recovery probability estimates
* Personalize recovery strategies
* Detect changing customer payment behaviour

### Communication

* Real WhatsApp Business integration
* Production email delivery
* SMS providers
* Multilingual recovery messages
* Customer self-service conversations

### Business Integrations

* ERP integrations
* Accounting software
* CRM integrations
* Automated invoice synchronization

### Analytics

* Cash-flow forecasting
* Recovery performance analytics
* Customer payment behaviour trends
* Collection-team performance insights

### Infrastructure

* PostgreSQL for production workloads
* Background job processing
* Event-driven architecture
* Advanced monitoring
* Role-based access control
* Production-grade authentication

---

# 🎯 Why It Matters

PayPromise AI is built around a simple idea:

> **Invoice recovery shouldn't be just about chasing overdue payments. It should be about making better decisions about when, how, and why to act.**

The platform brings together:

**Risk → Reasoning → Policy → Action → Payment → Verification**

into one connected workflow.

That means businesses can move from simply **seeing overdue invoices** to having a structured system for **deciding what to do next and measuring whether it worked**.

---

# 🏆 Project Highlights

```text
✓ AI-assisted invoice recovery
✓ Explainable recovery decisions
✓ Policy-controlled automation
✓ Promise-to-pay tracking
✓ Customer communication generation
✓ Razorpay payment integration
✓ Payment verification
✓ Idempotent payment handling
✓ Audit trail
✓ Recovery analytics
✓ 104 automated tests
✓ Live Railway deployment
```

---

# 📌 Project Links

🌐 **Live Demo:**
https://paypromise-ai-production.up.railway.app/

💻 **GitHub:**
https://github.com/sreevx/PayPromise-AI

---

## 👨‍💻 Built With

PayPromise AI was built as a practical exploration of how AI-assisted decision-making can be combined with payment workflows while keeping **policy, validation, and traceability** at the center of the system.

---

## 📄 License

This project is intended primarily as a hackathon/demo project.

See the repository for the applicable license and project terms.
