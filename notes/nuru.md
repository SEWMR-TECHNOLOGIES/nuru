Perfect. Thanks for the detailed brief. To design the database, I want to make sure we capture everything Nuru does. I’ll ask targeted questions first so we can determine the tables, relationships, and fields you’ll need.

---

### 1. Users & Roles

* We already agreed: one account per user. Users can be organizers, service providers, or attendees.
* Question: Should an attendee have a full account (login, profile), or just RSVP via email/phone without full signup?

---

### 2. Services / Providers

* Each service provider can offer multiple services (MC, catering, photography, etc.).
* Question: Do providers need availability schedules per service, or is availability handled per booking only?

---

### 3. Events

* Each event is created by a user (organizer) and can have multiple services booked.
* Question: Do you want events to have categories/types (wedding, corporate, burial) and metadata like expected guests, budget, location, date/time?

---

### 4. Bookings / Payments

* Services can be booked for events, payments are made via the platform.
* Question: Will you allow partial payments (deposits) and track payment status (pending, completed, refunded)?

---

### 5. Ratings & Reviews

* Users can rate services.
* Question: Should reviews also be tied to events, or just services independently?

---

### 6. Event Packages

* Predefined bundles of services for faster booking.
* Question: Can packages be customized by the organizer (e.g., swap a photographer for a videographer)?

---

### 7. Team Coordination & Tasks

* Organizers can assign tasks to team members or providers.
* Question: Do you want tasks tied to events only, or also to services (like “MC prep”)?

---

### 8. Messaging & Notifications

* Real-time messaging for organizers/providers/guests, plus automated notifications.
* Question: Should chat be persistent in the database, or just transient? Do you need read/unread tracking?

---

### 9. Budget & Expenses

* Track event spending and payments.
* Question: Should each service booked automatically create a budget entry, or is it manual entry by organizer?

---

### 10. Invitations & RSVPs

* Digital invitation cards, attendees can RSVP.
* Question: Do you want to track RSVP responses and attendance, or just whether the invite was sent?

---

### 11. Event Schedule & Maps

* Event schedules, session details, interactive maps.
* Question: Will multiple sessions exist per event (e.g., ceremony, reception), or just one block of time?
* Question: Do you want map locations to be linked to services/venues?

---

### 12. Guest Contributions & Polls

* Guests can contribute ideas and vote on polls.
* Question: Do you want contributions tied to specific sessions/services, or global per event?

---

### 13. Admin / Platform Management

* Admins manage users, services, disputes.
* Question: Do you want to track dispute history in a separate table with outcomes, or just log for reference?

---

If you answer these, I can draft a **full relational schema** with all the necessary tables, their relationships, and key fields, fully aligned with Nuru’s goals.

Do you want me to proceed table by table as we define each one, or just give the full schema at once after your answers?
