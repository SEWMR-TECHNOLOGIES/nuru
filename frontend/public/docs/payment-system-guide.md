# Nuru Payment System Guide

## 1. Core Principle

Nuru must not allow service without secured payment. All payments must pass through Nuru first. Nuru holds funds in escrow. Money is only released when conditions are met.

## 2. Payment Relationships

### A. User Pays Nuru

Users may pay:
- Platform service fee
- Booking protection fee
- Subscription fee if introduced later

Revenue model options:
- Commission from vendor payout
- Small service fee from organiser
- Both sides pay small percentage
- Vendor subscription model

Recommended early stage model:
- Vendor commission between 5% and 10%
- Optional small organiser protection fee of 3%

### B. Organiser Pays Vendor

This is the highest risk area. It must use escrow. Direct payment from organiser to vendor should never be allowed inside confirmed bookings.

### C. Contributors Pay Organiser

Use case example: Wedding contributions or pledges.

Flow:
1. Contributor pays through Nuru
2. Nuru deducts small fee
3. Funds move to organiser wallet
4. Organiser can withdraw

Optional: Funds may be held briefly before withdrawal for fraud monitoring.

### D. Ticket Buyers Pay Organiser

Flow:
1. Buyer purchases ticket
2. Payment goes to Nuru
3. Platform deducts ticket fee
4. Balance moves to organiser wallet

## 3. Escrow Model for Organiser to Vendor Payments

This is the foundation of trust.

### Step 1: Vendor Lists Service

Vendor defines:
- Service description
- Price
- Event date
- Cancellation terms
- Refund rules

### Step 2: Organiser Books Vendor

Booking is not confirmed yet.

### Step 3: Organiser Pays Nuru

Money goes to Nuru escrow wallet. Only after payment:
- Booking status becomes **Confirmed**
- Vendor receives notification
- Funds secured message is sent

If organiser does not pay within time limit, booking expires automatically. No payment means no obligation.

## 4. Event Completion Flow

After event date, the system enters the completion phase.

### Standard Model

1. Event date passes
2. Organiser has 24 to 48 hours to confirm or dispute
3. If organiser confirms service delivered, funds are released
4. If organiser does nothing, funds auto-release after timer

Auto-release protects vendors from dishonest organisers.

## 5. Protecting Vendors from Non-Payment

Vendor never works without escrow secured.

If organiser refuses to confirm after event:
- Auto-release triggers after waiting period
- Organiser must actively dispute to block release

## 6. Protecting Organisers from No-Show Vendors

If vendor fails to appear:
- Organiser opens dispute before release

Possible evidence:
- Chat logs
- Event photos
- Witness statements
- Location data if implemented

If vendor is at fault:
- Full refund to organiser
- Vendor penalty applied
- Rating reduced
- Possible suspension

## 7. Event OTP Check-In

This creates proof of presence.

Flow at event start:
1. Vendor clicks **Arrived**
2. System generates one-time code
3. Organiser gives vendor the code
4. Vendor enters code in system

System logs:
- Vendor present
- Organiser acknowledged presence
- Timestamp recorded

This protects vendor strongly against false claims.

## 8. Partial Payment Model for Large Events

For expensive services such as catering or decoration.

Example structure:
- 30% booking deposit
- 70% escrow balance

Deposit rules:
- Non-refundable after certain date
- Covers vendor preparation cost

If organiser cancels late, vendor keeps deposit. If vendor cancels, deposit is refunded and vendor is penalised.

## 9. Vendor Security Deposit System

Optional. High-value vendors provide a small refundable platform deposit to join.

If vendor fails to show without valid reason, a penalty is deducted from their security deposit. This increases platform trust.

## 10. Dispute Resolution System

### Dispute Window
- 24 to 48 hours after event
- Organiser must provide reason
- Vendor allowed to respond

### Evidence Types
- OTP logs
- Photos
- Messages
- Timeline records

### Admin Decision Outcomes
- Release funds to vendor
- Refund organiser
- Partial split if appropriate

Dispute policy must be written clearly inside Terms of Service.

## 11. Cancellation Policy

For full cancellation terms, windows, and refund rules, refer to the [Nuru Cancellation Policy](/docs/cancellation-policy).

Vendors must set cancellation terms within allowed limits. Organisers must see these terms before payment.

## 12. Rating and Accountability System

### Vendor Reputation
- No-show reduces rating heavily
- Late cancellation reduces ranking
- Multiple violations lead to suspension

### Organiser Accountability
- Organisers can also be rated
- Repeated false disputes result in account flagging

Trust applies both ways.

## 13. Fraud and Abuse Risks

Risks to prepare for:
- Fake disputes
- Collusion between users
- Chargebacks from card payments
- Fake bookings

Mitigation:
- Auto-release timer
- OTP check-in
- Manual dispute review
- Temporary holding period before withdrawals
- Account verification process

## 14. Legal and Compliance Considerations

Holding money means acting as a financial intermediary.

Considerations:
- Business registration for payment processing
- Proper accounting
- Transparent fee structure
- Clear refund policy

Integration options:
- Mobile money providers
- Card payment gateways

Funds must land in Nuru escrow account first, not directly in vendor accounts.

## 15. Withdrawal Rules

### For Vendors
- Funds available only after release
- Optional delay of 24 hours before withdrawal to prevent fraud

### For Organisers
- Contribution and ticket funds may move to organiser wallet
- Withdrawal subject to small processing delay

## 16. Revenue Structure Summary

Recommended early stage model:
- Vendor commission: 5% to 10%
- Optional organiser protection fee: 2% to 3%
- Ticket processing fee
- Contribution processing fee

Keep fees transparent. Hidden fees destroy trust.
