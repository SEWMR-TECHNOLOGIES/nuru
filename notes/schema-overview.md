Perfect. Based on your answers, we can now design the tables needed for Nuru. I’ll outline **core tables**, their **relationships**, and key fields. This will be a solid foundation for your FastAPI backend using SQLAlchemy/PostgreSQL.

---

## **1. Users & Accounts**

* **users**
  Stores all platform users: organizers, service providers, attendees.

```sql
users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE,
    phone text,
    password_hash text,
    role text DEFAULT 'user', -- basic role: user, can expand to 'admin' if needed
    created_at timestamp DEFAULT now()
);
```

* **attendee\_profiles** (optional, for RSVPs without full accounts)

```sql
attendee_profiles (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    rsvp_code text UNIQUE,
    created_at timestamp DEFAULT now()
);
```

---

## **2. Service Providers & Services**

* **services**

```sql
services (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text, -- MC, Catering, Photography, etc.
    description text,
    price_range text,
    created_at timestamp DEFAULT now(),
    is_active boolean DEFAULT true
);
```

* **service\_availability**
  Tracks when a service is available.

```sql
service_availability (
    id uuid PRIMARY KEY,
    service_id uuid REFERENCES services(id) ON DELETE CASCADE,
    start_time timestamp,
    end_time timestamp,
    status text DEFAULT 'available' -- available/booked/unavailable
);
```

* **service\_reviews**

```sql
service_reviews (
    id uuid PRIMARY KEY,
    service_id uuid REFERENCES services(id) ON DELETE CASCADE,
    event_id uuid REFERENCES events(id), -- optional
    reviewer_id uuid REFERENCES users(id),
    rating int CHECK (rating BETWEEN 1 AND 5),
    comment text,
    created_at timestamp DEFAULT now()
);
```

---

## **3. Events**

* **events**

```sql
events (
    id uuid PRIMARY KEY,
    organizer_id uuid REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text, -- wedding, corporate, burial, etc.
    description text,
    start_time timestamp,
    end_time timestamp,
    location text,
    budget numeric,
    created_at timestamp DEFAULT now(),
    status text DEFAULT 'draft' -- draft, confirmed, completed, cancelled
);
```

* **event\_services**
  Links services booked to events.

```sql
event_services (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    service_id uuid REFERENCES services(id) ON DELETE CASCADE,
    price numeric,
    deposit numeric,
    payment_status text DEFAULT 'pending', -- pending, completed, refunded
    assigned_staff text, -- optional: assigned provider staff
    created_at timestamp DEFAULT now()
);
```

* **event\_guests**

```sql
event_guests (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id),
    rsvp_status text DEFAULT 'pending', -- accepted, declined, pending
    created_at timestamp DEFAULT now()
);
```

* **event\_comments**

```sql
event_comments (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id),
    content text,
    created_at timestamp DEFAULT now()
);
```

* **event\_shares**
  Tracks event shares (optional for analytics).

```sql
event_shares (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id),
    shared_by uuid REFERENCES users(id),
    platform text, -- e.g., WhatsApp, Facebook
    created_at timestamp DEFAULT now()
);
```

---

## **4. Event Packages**

* **packages**

```sql
packages (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    description text,
    price numeric,
    created_at timestamp DEFAULT now()
);
```

* **package\_services**

```sql
package_services (
    id uuid PRIMARY KEY,
    package_id uuid REFERENCES packages(id) ON DELETE CASCADE,
    service_id uuid REFERENCES services(id) ON DELETE CASCADE
);
```

* Customizations can be handled via `event_services` overrides.

---

## **5. Tasks / Team Coordination**

* **event\_tasks**

```sql
event_tasks (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    service_id uuid REFERENCES services(id), -- optional, ties task to a provider
    assigned_to uuid REFERENCES users(id), -- can be organizer or provider staff
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending', -- pending, in_progress, completed
    due_time timestamp,
    created_at timestamp DEFAULT now()
);
```

---

## **6. Messaging & Notifications**

* **chats**

```sql
chats (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES users(id),
    recipient_id uuid REFERENCES users(id),
    message text,
    read boolean DEFAULT false,
    created_at timestamp DEFAULT now()
);
```

* **notifications**

```sql
notifications (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    type text, -- payment, schedule_update, message, etc.
    content text,
    is_read boolean DEFAULT false,
    created_at timestamp DEFAULT now()
);
```

---

## **7. Budget & Expenses**

* **event\_budget\_items**

```sql
event_budget_items (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    service_id uuid REFERENCES services(id), -- optional
    title text NOT NULL,
    cost numeric,
    paid numeric DEFAULT 0,
    status text DEFAULT 'pending', -- pending, paid
    created_at timestamp DEFAULT now()
);
```

---

## **8. Invitations & RSVPs**

* **invitations**

```sql
invitations (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    recipient_email text,
    recipient_phone text,
    rsvp_status text DEFAULT 'pending', -- accepted, declined
    sent_at timestamp,
    responded_at timestamp
);
```

---

## **9. Event Schedule & Maps**

* **event\_sessions**

```sql
event_sessions (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    name text,
    description text,
    start_time timestamp,
    end_time timestamp,
    location text
);
```

* **venue\_maps**

```sql
venue_maps (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    service_id uuid REFERENCES services(id), -- optional
    name text,
    map_data jsonb, -- can store coordinates, zones, pins
    created_at timestamp DEFAULT now()
);
```

---

## **10. Guest Contributions & Polls**

* **guest\_contributions**

```sql
guest_contributions (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id),
    content text,
    created_at timestamp DEFAULT now()
);
```

* **event\_polls**

```sql
event_polls (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    question text,
    created_at timestamp DEFAULT now()
);
```

* **poll\_options**

```sql
poll_options (
    id uuid PRIMARY KEY,
    poll_id uuid REFERENCES event_polls(id) ON DELETE CASCADE,
    option_text text
);
```

* **poll\_votes**

```sql
poll_votes (
    id uuid PRIMARY KEY,
    poll_id uuid REFERENCES event_polls(id),
    option_id uuid REFERENCES poll_options(id),
    user_id uuid REFERENCES users(id)
);
```

---

## **11. Admin / Platform Management**

* **admins**

```sql
admins (
    id uuid PRIMARY KEY,
    name text,
    email text UNIQUE,
    password_hash text,
    created_at timestamp DEFAULT now()
);
```

* **disputes**

```sql
disputes (
    id uuid PRIMARY KEY,
    event_id uuid REFERENCES events(id),
    service_id uuid REFERENCES services(id), -- optional
    raised_by uuid REFERENCES users(id),
    assigned_admin uuid REFERENCES admins(id),
    status text DEFAULT 'open', -- open, resolved, closed
    description text,
    resolution text,
    created_at timestamp DEFAULT now(),
    resolved_at timestamp
);
```

---

This schema covers:

* Users (organizers, providers, attendees)
* Services and availability
* Events, bookings, packages, tasks
* Messaging, notifications
* Budget and payments
* Invitations, schedules, maps
* Guest contributions and polls
* Admins and disputes

It also supports **all of Nuru’s core features** and ensures flexibility for multiple roles and advanced event management.

---

If you want, I can **draw an ER diagram** next that shows all tables and their relationships visually. It’ll make implementing SQLAlchemy models way easier.

Do you want me to do that next?
