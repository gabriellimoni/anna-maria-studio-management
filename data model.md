Main entities
Representative (system user)

id — UUID
name — string
email — string, unique
password_hash — string
whatsapp — string
notify_new_interested — boolean (default: true)
notify_daily_summary — boolean (default: false)
created_at — timestamp
updated_at — timestamp

Company

id — UUID
representative_id — FK → Representative
legal_name — string
trade_name — string
tax_id — string (CNPJ), unique per representative
phone — string, nullable
contact_email — string, nullable
notes — text, nullable
created_at — timestamp
updated_at — timestamp

Customer

id — UUID
representative_id — FK → Representative
name — string
tax_id — string (CPF), nullable
whatsapp — string
email — string, nullable
notes — text, nullable
created_at — timestamp
updated_at — timestamp

Campaign

id — UUID
company_id — FK → Company
internal_title — string (representative's internal reference)
public_title — string (shown to the customer on the landing page)
description — text (landing page body)
whatsapp_message — text (template with {name} and {link} placeholders)
status — enum: draft, active, closed
created_at — timestamp
started_at — timestamp, nullable
closed_at — timestamp, nullable

Relationship tables
CompanyCustomer (N:N between Company and Customer)

id — UUID
company_id — FK → Company
customer_id — FK → Customer
created_at — timestamp
Constraint: unique(company_id, customer_id)

CampaignCustomer (campaign instance for each customer — the operational core)

id — UUID
campaign_id — FK → Campaign
customer_id — FK → Customer
access_token — unique string (builds the public landing link: /c/{token})
status — enum: not_sent, sent, viewed, interested, not_interested
sent_at — timestamp, nullable
viewed_at — timestamp, nullable
responded_at — timestamp, nullable
contacted_at — timestamp, nullable (representative marked as "contacted" after interest)
converted_at — timestamp, nullable (optional — closed deal)
created_at — timestamp
Constraint: unique(campaign_id, customer_id)

Audit / support tables
Notification

id — UUID
representative_id — FK → Representative
type — enum: new_interested, etc.
campaign_customer_id — FK → CampaignCustomer, nullable
read — boolean (default: false)
created_at — timestamp

Key modeling notes
About access_token in CampaignCustomer: this is the heart of tracking. Each customer gets a unique link per campaign (e.g. app.com/c/abc123xyz). When that URL is hit, the backend identifies exactly which customer in which campaign — no login needed. This token also lets you mark viewed_at on first access and update status to interested or not_interested on the button click.
Why Customer belongs to Representative and not to Company: customers may belong to several companies (N:N). They're a representative-level asset. The CompanyCustomer table is what defines which campaigns of which companies a given customer can receive.
Why the campaign message has placeholders: to support sending a custom wa.me link per customer in the MVP, the system needs to inject {name} and the unique {link} server-side when generating the WhatsApp URL the representative clicks.
Possible field that I left out on purpose for the MVP:

Company.logo_url — could be useful for the landing page, but we agreed the template is fixed. Easy to add later.
Campaign.cover_image_url — same reasoning.
Customer.last_contact_at — derivable from CampaignCustomer, no need to denormalize at this stage.

Suggested initial indexes
For query performance once data grows:

Company(representative_id)
Customer(representative_id)
Campaign(company_id, status)
CompanyCustomer(company_id) and CompanyCustomer(customer_id)
CampaignCustomer(campaign_id, status) — to power the campaign detail screen filters
CampaignCustomer(access_token) — unique, lookup by token on the public landing
CampaignCustomer(status, responded_at desc) filtered by representative — for the interested center
