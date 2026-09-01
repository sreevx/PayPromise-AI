\# PayPromise AI



\### AI-Powered Invoice Recovery \& Payment Assurance Platform



PayPromise AI is an intelligent invoice recovery platform designed to help businesses identify overdue-payment risk, prioritize recovery actions, automate customer follow-ups, manage promises to pay, and verify successful payments.



The system combines an explainable recovery engine, policy-controlled AI actions, audit logging, customer communication generation, and Razorpay payment integration into one closed-loop workflow.



\---



\## 🚀 Why PayPromise AI?



Overdue invoices create cash-flow problems and force finance teams to spend significant time manually following up with customers.



Traditional systems primarily answer:



> \*\*"Which invoices are overdue?"\*\*



PayPromise AI goes further:



> \*\*"Which invoice should we act on, why, what should we do next, and did the action actually recover the payment?"\*\*



\---



\## 🎯 Core Workflow



```text

Invoice

&#x20;  ↓

Customer \& Payment History

&#x20;  ↓

AI Recovery Analysis

&#x20;  ↓

Risk \& Recovery Probability

&#x20;  ↓

Recommended Action

&#x20;  ↓

Policy Engine

&#x20;  ↓

┌───────────────┬────────────────┬─────────────────┐

│ Send Reminder │ Request Promise│ Create Payment  │

│               │                │ Link            │

└───────────────┴────────────────┴─────────────────┘

&#x20;                      ↓

&#x20;                Follow-up / Escalation

&#x20;                      ↓

&#x20;                Payment Verification

&#x20;                      ↓

&#x20;                 Invoice Recovered

```



\---



\## ✨ Key Features



\### 1. Invoice Intelligence



\* Invoice status tracking

\* Overdue invoice identification

\* Recovery probability

\* Recommended recovery action

\* Follow-up tracking

\* Escalation levels

\* Recovery status tracking



\### 2. Explainable Recovery Engine



The recovery engine evaluates invoice and customer signals such as:



\* Days overdue

\* Customer risk score

\* Average payment time

\* Late-payment history

\* Amount due

\* Previous follow-ups

\* Promise-to-pay history

\* Payment history



The system produces:



\* Recovery probability

\* Risk level

\* Recommended action

\* Reasoning

\* Confidence score

\* Follow-up interval



\### 3. Policy-Controlled AI Actions



AI recommendations are not executed blindly.



Every action passes through the policy engine, which can return:



\* `ALLOW`

\* `BLOCK`

\* `ESCALATE`



This provides a governance layer between AI decision-making and real actions.



\### 4. Automated Recovery Actions



The platform supports recovery actions including:



\* Send reminder

\* Request promise to pay

\* Create payment link

\* Follow-up

\* Escalation

\* Stop recovery



\### 5. Customer Communication



The system generates recovery messages for channels including:



\* Email

\* SMS

\* WhatsApp



Messages can use different recovery tones such as:



\* Friendly

\* Firm

\* Urgent

\* Legal



\### 6. Promise-to-Pay Management



Customers can be tracked through promise-to-pay states:



\* Active

\* Fulfilled

\* Broken

\* Cancelled



\### 7. Audit Trail



Important AI and recovery actions are recorded with:



\* Action

\* Actor

\* Reason

\* Policy decision

\* Result

\* Timestamp



This makes the recovery process traceable and reviewable.



\### 8. Razorpay Payment Integration



PayPromise AI integrates with Razorpay for payment processing.



The system supports:



\* Payment creation

\* Payment links

\* Razorpay payment IDs

\* Payment status tracking

\* Webhook processing

\* Payment verification

\* Automatic invoice recovery updates



The hackathon demonstration uses Razorpay Test Mode.



\### 9. Revenue Monitoring



The platform tracks:



\* Total revenue

\* Revenue at risk

\* Revenue recovered

\* Total invoices

\* Overdue invoices

\* Recovered invoices

\* Average recovery time

\* AI recovery rate



\---



\## 🧠 Recovery Decision Engine



The recovery engine follows a structured process:



```text

Collect Signals

&#x20;     ↓

Calculate Risk

&#x20;     ↓

Calculate Recovery Probability

&#x20;     ↓

Generate Reasoning

&#x20;     ↓

Select Strategy

&#x20;     ↓

Apply Policy

&#x20;     ↓

Execute Approved Action

&#x20;     ↓

Record Result

```



The system is designed so that the decision can be inspected instead of treating the AI recommendation as an unexplained output.



\---



\## 🛡️ Policy \& Safety Layer



Financial automation requires controlled execution.



PayPromise AI therefore separates:



\*\*Decision → Policy → Execution\*\*



For example:



```text

AI recommends action

&#x20;       ↓

Policy evaluates action

&#x20;       ↓

&#x20;  ┌────┼────┐

&#x20;ALLOW BLOCK ESCALATE

&#x20;  ↓

Execute

```



This approach helps prevent inappropriate automated actions and allows sensitive cases to be escalated for human review.



\---



\## 💳 Payment Recovery Flow



The payment recovery workflow is:



```text

Overdue Invoice

&#x20;     ↓

AI Analysis

&#x20;     ↓

Payment Strategy

&#x20;     ↓

Payment Link

&#x20;     ↓

Customer Payment

&#x20;     ↓

Razorpay

&#x20;     ↓

Webhook

&#x20;     ↓

Payment Verification

&#x20;     ↓

Invoice → Paid / Recovered

```



The system stores relevant payment information including Razorpay payment IDs, payment status, amount, method, and response information.



\---



\## 🏗️ Architecture



```text

┌─────────────────────────────────────┐

│             Next.js UI              │

│                                     │

│ Dashboard │ Invoices │ Customers   │

│ Followups │ Audit    │ Revenue     │

└──────────────────┬──────────────────┘

&#x20;                  │

&#x20;                  ▼

┌─────────────────────────────────────┐

│         Application / API Layer     │

│                                     │

│ Recovery Actions │ Payments         │

│ Webhooks         │ Demo Controls    │

└──────────────────┬──────────────────┘

&#x20;                  │

&#x20;         ┌────────┴────────┐

&#x20;         ▼                 ▼

┌─────────────────┐ ┌─────────────────┐

│ Recovery Engine │ │ Razorpay        │

│                 │ │ Integration     │

│ Scoring         │ │                 │

│ Reasoning       │ │ Payment Links   │

│ Strategy        │ │ Webhooks        │

│ Policy          │ │ Verification    │

│ Actions         │ │                 │

└────────┬────────┘ └────────┬────────┘

&#x20;        │                   │

&#x20;        └─────────┬─────────┘

&#x20;                  ▼

&#x20;         ┌─────────────────┐

&#x20;         │     Prisma      │

&#x20;         │                 │

&#x20;         │ SQLite Database │

&#x20;         └─────────────────┘

```



\---



\## 🧰 Tech Stack



| Layer           | Technology                             |

| --------------- | -------------------------------------- |

| Frontend        | Next.js                                |

| UI              | React                                  |

| Styling         | Tailwind CSS                           |

| Language        | TypeScript                             |

| Backend         | Next.js API routes / server-side logic |

| ORM             | Prisma                                 |

| Database        | SQLite                                 |

| Payments        | Razorpay                               |

| Testing         | TypeScript + tsx                       |

| Package Manager | npm                                    |



\---



\## 📁 Project Structure



```text

PayPromise-AI/

│

├── \_\_tests\_\_/

│   └── engine.test.ts

│

├── prisma/

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

├── tsconfig.json

└── .gitignore

```



\---



\## 🧪 Testing



PayPromise AI includes automated tests covering the core recovery engine and decision workflow.



Run:



```bash

npm test

```



The current validated test result is:



```text

104 / 104 tests passing

```



\---



\## ⚙️ Local Setup



\### 1. Clone the repository



```bash

git clone https://github.com/sreevx/PayPromise-AI.git

cd PayPromise-AI

```



\### 2. Install dependencies



```bash

npm install

```



\### 3. Configure environment variables



Create a `.env` file:



```env

RAZORPAY\_KEY\_ID=your\_key\_id

RAZORPAY\_KEY\_SECRET=your\_key\_secret

RAZORPAY\_WEBHOOK\_SECRET=your\_webhook\_secret

```



Never commit the `.env` file.



\### 4. Generate Prisma Client



```bash

npx prisma generate

```



\### 5. Initialize the database



```bash

npx prisma db push

```



\### 6. Seed demo data



```bash

npm run db:seed

```



\### 7. Start the development server



```bash

npm run dev

```



Open:



```text

http://localhost:3000

```



\---



\## 🔄 Reset Demo Data



To reset the local database and reseed the demonstration data:



```bash

npm run db:reset

```



\---



\## 💰 Razorpay Integration



The project uses Razorpay Test Mode for demonstration.



Required variables:



```env

RAZORPAY\_KEY\_ID=

RAZORPAY\_KEY\_SECRET=

RAZORPAY\_WEBHOOK\_SECRET=

```



The webhook endpoint is:



```text

/api/webhooks/razorpay

```



Payment synchronization is handled through:



```text

/api/sync-payment

```



For production use, webhook security, HTTPS, secret management, authentication, monitoring, and retry handling should be configured appropriately.



\---



\## 📊 Demonstration Flow



A typical demonstration follows:



```text

Dashboard

&#x20;  ↓

Select overdue invoice

&#x20;  ↓

View AI recovery analysis

&#x20;  ↓

Inspect reasoning \& recommendation

&#x20;  ↓

Execute approved recovery action

&#x20;  ↓

View generated communication

&#x20;  ↓

Inspect audit trail

&#x20;  ↓

Complete payment using Razorpay Test Mode

&#x20;  ↓

Webhook verification

&#x20;  ↓

Invoice marked recovered

```



\---



\## 🔐 Security Considerations



The repository intentionally excludes:



\* Environment files

\* API secrets

\* Local database files

\* Node modules

\* Next.js build output

\* Local project metadata



Production deployment should additionally implement:



\* Secure secret storage

\* Authentication and authorization

\* HTTPS

\* Webhook signature verification

\* Rate limiting

\* Request validation

\* Monitoring and alerting

\* Secure database infrastructure



\---



\## ⚠️ Current Limitations



\* Razorpay integration is demonstrated using Test Mode.

\* Customer communication is generated/stored by the application rather than relying on production messaging delivery infrastructure.

\* Recovery intelligence currently uses a structured deterministic decision engine rather than a trained machine-learning model.

\* SQLite is used for local/demo persistence.



\---



\## 🚀 Future Scope



Potential production enhancements include:



\* Adaptive recovery models trained on historical outcomes

\* Real WhatsApp Business integration

\* Production email delivery

\* ERP/accounting integrations

\* Customer self-service payment portal

\* Collections-team work queues

\* Multi-language communication

\* Advanced cash-flow forecasting

\* Role-based access control

\* Production-grade analytics

\* Event queues and asynchronous processing



\---



\## 🎯 Impact



PayPromise AI aims to help businesses:



\* Prioritize overdue invoices

\* Reduce manual collection effort

\* Make recovery decisions more consistently

\* Explain why a recovery action was selected

\* Apply governance before automated execution

\* Track customer commitments

\* Verify successful payments

\* Measure recovery performance



\---



\## 🏆 Hackathon Demo



PayPromise AI demonstrates a complete recovery loop:



\*\*Analyze → Decide → Govern → Act → Verify → Recover\*\*



Instead of treating invoice collection as a series of manual reminders, the platform turns it into an intelligent and auditable workflow.



\---



\## 👥 Team



\*\*PayPromise AI Team\*\*



Built as a hackathon project focused on intelligent financial automation and payment recovery.



\---



\## 📄 License



This project is intended as a hackathon demonstration project.



