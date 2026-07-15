# Billing — Kairos SaaS Platform

## Overview

Kairos supports Stripe-based billing with subscription plans, usage metering, and regional pricing.

## Plans

| Plan | Price (USD/mo) | Knowledge Bases | Documents | Storage | Agents |
|------|----------------|-----------------|-----------|---------|--------|
| Free | $0 | 2 | 50 | 500 MB | 0 |
| Starter | $12 | 20 | 2,000 | 10 GB | 2 |
| Pro | $29 | Unlimited | Unlimited | 100 GB | 10 |
| Team | $79 | Unlimited | Unlimited | 1 TB | Unlimited |
| Enterprise | Custom | Unlimited | Unlimited | Custom | Unlimited |

## Feature Tiers

| Feature | Free | Starter | Pro | Team | Enterprise |
|---------|------|---------|-----|------|------------|
| AI Chats | ✓ | ✓ | ✓ | ✓ | ✓ |
| OCR | Basic | Standard | Advanced | Advanced | Enterprise |
| Vision Models | ✗ | ✓ | ✓ | ✓ | ✓ |
| Deep Research | ✗ | Limited | Unlimited | Unlimited | Unlimited |
| API Access | ✗ | ✓ | ✓ | ✓ | Dedicated |
| Team Members | 1 | 1 | 1 | 25 | Unlimited |
| Audit Logs | ✗ | ✗ | ✓ | ✓ | ✓ |
| RBAC | ✗ | ✗ | ✓ | ✓ | ✓ |
| SSO | ✗ | ✗ | ✗ | Optional | ✓ |
| SLA | Community | Email | Priority | 24/7 | Dedicated |

## Setup

1. Create a Stripe account
2. Create products and prices in Stripe Dashboard
3. Set environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Configure Stripe Price IDs in `src/lib/billing/plans.ts`
5. Set up webhook endpoint: `POST /api/stripe/webhook`

## Webhook Events

Handled events:
- `checkout.session.completed` — New subscription
- `customer.subscription.updated` — Plan changes
- `customer.subscription.deleted` — Cancellation

## Regional Pricing

Prices are displayed in local currency based on:
1. Cloudflare `cf-ipcountry` header
2. Vercel `x-vercel-ip-country` header
3. `Accept-Language` header
4. Default: USD

Supported currencies: USD, EUR, GBP, INR, CAD, AUD, JPY

## Usage Metering

Usage is tracked per user per month:
- `knowledgeBases` — Active knowledge bases
- `documents` — Total documents
- `aiChats` — AI chat requests
- `uploads` — Daily uploads
- `storageMB` — Storage used
- `agents` — Agent usage

Usage resets at the start of each month.

## Entitlements

Every API endpoint checks entitlements via `checkEntitlement(userId, meter)`. Features are enforced server-side — never rely on frontend hiding.
