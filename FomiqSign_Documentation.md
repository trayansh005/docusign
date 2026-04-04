# FomiqSign - Technical Documentation

FomiqSign is a high-performance digital signature platform built with a modern web stack, designed for seamless document signing, tracking, and management.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Rendering**: React 19 with Server Components
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Data Fetching**: [TanStack Query (v5)](https://tanstack.com/query/latest)
- **Document Rendering**: `react-pdf`, `mammoth` (DOCX support)
- **Digital Signatures**: `react-signature-canvas`
- **UI Components**: Radix UI primitives, Sonner (Toasts)
- **Utilities**: `zod` (validation), `lucide-react` (icons)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
- **API Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/) (high-performance compositing)
- **PDF Manipulation**: [pdf-lib](https://pdf-lib.js.org/)
- **Payments**: [Stripe](https://stripe.com/)
- **Security**: Helmet, HPP, Express-Rate-Limit, BcryptJS
- **Authentication**: JWT-based auth via `jose` and `cookie-parser`

---

## 📄 Page Architecture

### Public Pages
- `/`: **Main Landing Page** – High-conversion hero section and product overview.
- `/login`: **Authentication** – Secure login interface.
- `/register`: **Onboarding** – New user account creation.
- `/contact`: **Support** – Direct contact form for inquiries.
- `/terms-of-service`: **Compliance** – Legal and usage policies.

### Core Application (`/fomiqsign`)
- `/dashboard`: **Document Hub** – Centralized management of sent and received documents.
- `/sign/[templateId]`: **Signer Interface** – Specialized viewer for recipients to apply signatures.
- `/activity`: **System Audit** – Real-time tracking of signing events and document history.
- `/status-tracker`: **Timeline** – Visual progress of multiple signers for active documents.

### User Management
- `/profile`: **Identity** – Personal details and signature preferences.
- `/settings`: **Preferences** – Notification and security settings.
- `/subscription`: **Billing** – Plan management and Stripe checkout integration.

---

## ✍️ Signature Workflow

The FomiqSign signature process is designed for precision and legal auditability:

1.  **Template Generation**: PDFs are uploaded and converted to high-resolution PNGs (per page) for rapid web viewing.
2.  **Field Mapping**: Senders place signature, initial, and date fields using a drag-and-drop interface.
3.  **Signing Eligibility**: The system utilizes `checkSigningEligibility` to enforce signing orders and ensure security.
4.  **Recipient Interaction**:
    -   Recipients open a unique `/sign/[templateId]` link.
    -   `RecipientDocumentViewer` captures user inputs (drawn signatures, typed text, or dates).
5.  **Secure Processing**:
    -   Signatures and coordinates are transmitted to the backend.
    -   **Backend Compositing**: The `applySignatures` controller uses **Sharp** to merge signature buffers with document images.
    -   **Audit Trail**: IP addresses and geolocations are captured for every signing event.
6.  **Finalization**: Once all fields are signed, the document status transitions to `final`, and the signed assets are securely stored.

---

## 🚧 Missing & Pending Features

While the core signature engine is robust, several features are slated for future development:

### ✉️ Notifications (Email/SMS)
- **Current State**: `NotificationService` handles basic signing requests via Nodemailer.
- **Missing**:
    -   **Transactional SMS**: Integration with Twilio/AWS SNS for mobile alerts.
    -   **Email Verification**: Full automated flow for new account validation.
    -   **Password Recovery**: "Forgot Password" UI and backend email triggering.

### 🛡️ Account & Auth
- **Social Auth**: OAuth integration (Google, Microsoft) for faster onboarding.
- **Two-Factor Auth (2FA)**: Enhanced security via TOTP or SMS-based codes.


