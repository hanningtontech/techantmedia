import type { PhotoContract } from "@/lib/contracts/contractTypes";
import { FILL_LONG, FILL_MEDIUM, FILL_SHORT } from "@/lib/contracts/contractMarkdownUtils";

export const DEFAULT_PHOTO_CONTRACTS: PhotoContract[] = [
  {
    slug: "photography-videography",
    title: "Photography & Videography Contract",
    shortLabel: "Photo / Video contract",
    description:
      "Booking agreement for photography and videography services — client details, charges, delivery terms, and standard terms.",
    downloadPdfUrl: "",
    markdown: `**TECHANTMEDIA PRODUCTION**

---

## Client's information

| Field | Details |
| --- | --- |
| Client's name | ${FILL_LONG} |
| Address | ${FILL_LONG} |
| Tel | ${FILL_MEDIUM} |
| ID No | ${FILL_MEDIUM} |
| Email | ${FILL_LONG} |

---

## Event details

| | |
| --- | --- |
| **Event date** | ${FILL_MEDIUM} |
| **Start time** | ${FILL_SHORT} |
| **End time** | ${FILL_SHORT} |

### Locations for photography

| Location | Time |
| --- | --- |
| Location 1 | ${FILL_MEDIUM} |
| Location 2 | ${FILL_MEDIUM} |

---

## Charges

The package fee is based on the Photographer's Standard Price List and includes the described photography. If the fee is not based on a package but a session fee, all photographs shall be billed in addition to the session fee as per the Standard Price List. Extra charges listed below shall be billed as incurred.

### Package contents

| Description | Price (Ksh) |
| --- | --- |
| Package type | ${FILL_MEDIUM} |
| Number of hours | ${FILL_MEDIUM} |
| Video type | ${FILL_MEDIUM} |
| Photos type | ${FILL_MEDIUM} |
| Additional fee | ${FILL_MEDIUM} |
| Website access | ☐ Yes / No |
| Picture CD | ☐ Yes / No |

| | Ksh |
| --- | --- |
| **Total** | ${FILL_MEDIUM} |
| Less deposit | ${FILL_MEDIUM} |
| **Balance due** (due on event date) | ${FILL_MEDIUM} |

---

## Commercial use & delivery terms

### 1. Turnaround time

TechantMedia Productions shall deliver the final professionally edited photos within **3–14 business days** from the date of the shoot. Final videos (YouTube format or Reels) will be delivered within **7–14 business days**, unless otherwise agreed in writing.

### 2. Content delivery format

- Photos: high-resolution JPEG via Google Drive or online gallery.
- Videos: MP4 optimized for YouTube (landscape) or Instagram Reels (vertical).
- RAW files are not shared unless agreed in writing and may attract additional fees.

### 3. Usage rights

The Client receives a **non-exclusive commercial license** for promotional use on digital platforms (social media, websites, online advertising). Mass distribution, third-party resale, or print ads (billboards, magazines) require a separate commercial licensing agreement.

### 4. Additional edits & revisions

One round of general revisions is included. Extensive requests beyond the original brief may attract extra fees from **Ksh 300** per image or per minute of video.

### 5. Storage & backup policy

Final files are stored for **90 days** from delivery. Clients must download and back up materials. Retrieval after 90 days may incur **30%** of the agreed shoot charges.

---

## Terms and conditions

1. **Exclusive photographer** — Photographer is the exclusive photographer retained for the event. Guests may photograph provided they do not interfere.
2. **Deposit & payment** — Client pays a deposit to reserve services. Balance is due before or on the event day.
3. **Cancellation** — Cancellation within 90 days forfeits deposit. Earlier cancellations may refund part of the deposit.
4. **Copyright and reproductions** — Photographer owns copyright. Client receives limited reproduction rights (prints, portfolio). No sale, contest, or exhibition use without written permission.
5. **Client's usage** — Personal use only; print/media use requires credit to Photographer.
6. **Failure to perform** — Not liable for cancellations due to illness, accident, or other causes. Liability limited to deposit refund.
7. **Substitution** — A qualified substitute may be sent if Photographer cannot attend.
8. **Inherent qualities** — No liability for fading, discoloration, or damage to media over time.
9. **Standard price list** — Pricing subject to updates; latest rate at time of order applies.
10. **Miscellaneous** — Entire agreement; amendments must be written and signed by both parties.

---

## Agreement

Agreed delivery date: ${FILL_MEDIUM}

The parties have read this Agreement, agree to all terms, and acknowledge receipt of a signed copy. Each person signing as Client is responsible for ensuring full payment per the terms.

| | |
| --- | --- |
| **Client's signature** | ${FILL_LONG} **Date** ${FILL_SHORT} |
| **Photographer's signature** | TechantMedia **Date** ${FILL_SHORT} |
`,
  },
  {
    slug: "vixen-release",
    title: "Vixen Release & Consent Agreement",
    shortLabel: "Vixen release",
    description:
      "Model release for commercial photo and video use by TechantMedia Productions, including consent, liability waiver, and signatures.",
    downloadPdfUrl: "",
    markdown: `**TechantMedia Productions**

This Agreement is made on ${FILL_MEDIUM} (Date), for: ${FILL_MEDIUM} (Event)

---

## 1. Parties

- **Photographer / Producer:** TechantMedia Productions
- **Model / Vixen name:** ${FILL_LONG}
- **ID / Passport No:** ${FILL_LONG}
- **Phone:** ${FILL_MEDIUM}
- **Email:** ${FILL_LONG}

---

## 2. Project details

This agreement applies to all photo or video shoots conducted by TechantMedia Productions, including commercial, promotional, or creative projects in which the above-named Vixen appears.

---

## 3. Consent & permission

The Model grants TechantMedia Productions and its assigns the **unrestricted, perpetual, worldwide** right to use, publish, distribute, and modify recorded images, videos, and audio for:

- Commercial advertising (social media, websites, reels, campaigns)
- Portfolio use
- YouTube, Instagram, and any digital or print platform
- Marketing and branding

The Vixen waives compensation or approval of final edited content unless otherwise agreed in writing.

---

## 4. No ownership or copyright claims

All images, footage, and copyrights remain the **sole property of TechantMedia Productions**. The Vixen shall not claim ownership or demand removal or royalties after publication.

---

## 5. Release of liability

The Vixen releases TechantMedia Productions, its representatives, and clients from claims including invasion of privacy, defamation, copyright disputes, or misrepresentation arising from use of the content.

---

## 6. Optional terms

- ☐ I consent to my name/handle being tagged or credited
- ☐ I prefer to remain anonymous in public uploads
- ☐ I consent to behind-the-scenes (BTS) content including me being published

---

## 7. Signatures

| | |
| --- | --- |
| **Vixen's signature** | ${FILL_LONG} **Date** ${FILL_SHORT} |
| **Photographer's signature** | ${FILL_LONG} **Date** ${FILL_SHORT} |

---

## Optional (for minors under 18)

| | |
| --- | --- |
| **Parent / guardian name** | ${FILL_LONG} |
| **Signature** | ${FILL_LONG} |
| **Phone** | ${FILL_MEDIUM} |
`,
  },
];

export function getDefaultContract(slug: string): PhotoContract | undefined {
  return DEFAULT_PHOTO_CONTRACTS.find((c) => c.slug === slug);
}
