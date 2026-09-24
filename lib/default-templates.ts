import { TemplateRecord } from "./types";

export const DEFAULT_TEMPLATES: TemplateRecord[] = [
  {
    "id": "tpl_promo_1",
    "name": "⚡ Flash Sale & Discount Code",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "code",
      "link"
    ],
    "text": "Salam {name}! Exclusive MEGA SALE: Enjoy FLAT {discount}% OFF on all products today only. Shop online: {link} Use coupon code: {code}. Express delivery all over Pakistan! 🇵🇰"
  },
  {
    "id": "tpl_promo_2",
    "name": "🆕 New Arrival Announcement",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "product",
      "link"
    ],
    "text": "Hi {name}, guess what just landed? {product} is now live on our store! Be the first to grab it: {link}. Limited stock available."
  },
  {
    "id": "tpl_promo_3",
    "name": "🌙 Eid Sale Special",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "link"
    ],
    "text": "Eid Mubarak {name}! Celebrate with us — get {discount}% OFF storewide this Eid season. Shop now: {link}. Offer valid for a limited time only."
  },
  {
    "id": "tpl_promo_4",
    "name": "🕌 Ramadan Mega Offer",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "link"
    ],
    "text": "Ramadan Kareem {name}! Enjoy {discount}% OFF on Iftar & Sehri essentials all month long. Order here: {link}. Free delivery on orders above PKR 1500."
  },
  {
    "id": "tpl_promo_5",
    "name": "🎁 Bundle Deal Offer",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "bundle_name",
      "price",
      "link"
    ],
    "text": "Hi {name}, save more with our {bundle_name} combo deal — now just PKR {price}! Grab the bundle before it's gone: {link}."
  },
  {
    "id": "tpl_promo_6",
    "name": "🚚 Free Delivery Weekend",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "city",
      "link"
    ],
    "text": "Good news {name}! Enjoy FREE home delivery in {city} this weekend on all orders. Order now: {link}. No minimum purchase required."
  },
  {
    "id": "tpl_promo_7",
    "name": "🤝 Referral Bonus Offer",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "reward",
      "ref_link"
    ],
    "text": "Hi {name}, invite your friends & earn {reward} for every successful referral! Share your link: {ref_link} and start earning today."
  },
  {
    "id": "tpl_promo_8",
    "name": "⭐ Loyalty Points Update",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "points",
      "link"
    ],
    "text": "Dear {name}, you now have {points} loyalty points in your wallet! Redeem them on your next purchase: {link}. Points expire soon, don't miss out."
  },
  {
    "id": "tpl_promo_9",
    "name": "🏷️ Clearance Sale Alert",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "link"
    ],
    "text": "Salam {name}! Our biggest CLEARANCE sale is here — up to {discount}% OFF on selected items. Shop before stock runs out: {link}."
  },
  {
    "id": "tpl_promo_10",
    "name": "🎉 Weekend Special Offer",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "link"
    ],
    "text": "Hi {name}, weekend vibes call for weekend savings! Get {discount}% OFF this Saturday & Sunday only. Shop now: {link}."
  },
  {
    "id": "tpl_promo_11",
    "name": "🎯 First Order Discount",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "code",
      "link"
    ],
    "text": "Welcome {name}! As a first-time customer, enjoy {discount}% OFF your first order using code {code}. Start shopping: {link}."
  },
  {
    "id": "tpl_promo_12",
    "name": "💰 Cashback Offer",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "cashback",
      "link"
    ],
    "text": "Hi {name}, get PKR {cashback} cashback on your next order via Easypaisa/JazzCash! Shop now: {link}. Offer valid for a limited time."
  },
  {
    "id": "tpl_promo_13",
    "name": "💳 Bank Card Discount",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "bank",
      "discount",
      "link"
    ],
    "text": "Salam {name}! Pay with your {bank} card and get an extra {discount}% OFF instantly. Shop here: {link}."
  },
  {
    "id": "tpl_promo_14",
    "name": "🛍️ Buy 1 Get 1 Free",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "category_name",
      "link"
    ],
    "text": "Hi {name}, our Buy 1 Get 1 FREE offer on {category_name} is now live! Grab yours before it ends: {link}."
  },
  {
    "id": "tpl_promo_15",
    "name": "🇵🇰 Independence Day Sale",
    "category": "promo",
    "isPreset": true,
    "variables": [
      "name",
      "discount",
      "link"
    ],
    "text": "Happy Independence Day {name}! Celebrate 14 August with {discount}% OFF storewide. Shop the Jashn-e-Azadi sale: {link}."
  },
  {
    "id": "tpl_txn_1",
    "name": "✅ Order Confirmed",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "amount"
    ],
    "text": "Dear {name}, your order #{order_id} worth PKR {amount} has been confirmed. We will notify you once it's shipped. Thank you for shopping with us!"
  },
  {
    "id": "tpl_txn_2",
    "name": "📦 Order Dispatched & Live Tracking",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "courier",
      "tracking_link"
    ],
    "text": "Dear {name}, your order #{order_id} has been dispatched via {courier}! Track your parcel delivery here: {tracking_link} . Expected delivery within 24-48 hours."
  },
  {
    "id": "tpl_txn_3",
    "name": "🏠 Order Delivered Successfully",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id"
    ],
    "text": "Hi {name}, your order #{order_id} has been delivered successfully. We hope you love it! Please rate your experience whenever you get a chance."
  },
  {
    "id": "tpl_txn_4",
    "name": "❌ Order Cancelled Confirmation",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "reason"
    ],
    "text": "Dear {name}, your order #{order_id} has been cancelled. Reason: {reason}. If this was a mistake, please contact our support team immediately."
  },
  {
    "id": "tpl_txn_5",
    "name": "💵 Refund Processed",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "amount",
      "days"
    ],
    "text": "Hi {name}, a refund of PKR {amount} for order #{order_id} has been processed. It will reflect in your account within {days} business days."
  },
  {
    "id": "tpl_txn_6",
    "name": "🧾 Payment Received",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "order_id"
    ],
    "text": "Dear {name}, we have received your payment of PKR {amount} for order #{order_id}. Your order is now being processed. Thank you!"
  },
  {
    "id": "tpl_txn_7",
    "name": "⚠️ Payment Failed Notice",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "retry_link"
    ],
    "text": "Hi {name}, your payment for order #{order_id} could not be processed. Please retry using this link: {retry_link} to confirm your order."
  },
  {
    "id": "tpl_txn_8",
    "name": "📞 COD Order Confirmation Call",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "phone"
    ],
    "text": "Dear {name}, please confirm your Cash on Delivery order #{order_id}. Our team will call you on {phone} shortly to verify the details."
  },
  {
    "id": "tpl_txn_9",
    "name": "💳 Invoice & Payment Reminder",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "invoice_no",
      "amount",
      "due_date",
      "pay_link"
    ],
    "text": "Reminder for {name}: Invoice #{invoice_no} amounting to PKR {amount} is due on {due_date}. Pay securely via Easypaisa/JazzCash/Bank at: {pay_link}. Thank you!"
  },
  {
    "id": "tpl_txn_10",
    "name": "🔄 Subscription Renewed",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "plan",
      "amount",
      "next_date"
    ],
    "text": "Hi {name}, your {plan} subscription has been renewed for PKR {amount}. Next renewal date: {next_date}. Thank you for staying with us!"
  },
  {
    "id": "tpl_txn_11",
    "name": "⏳ Subscription Expiring Soon",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "plan",
      "expiry_date",
      "link"
    ],
    "text": "Dear {name}, your {plan} subscription is expiring on {expiry_date}. Renew now to avoid interruption: {link}."
  },
  {
    "id": "tpl_txn_12",
    "name": "🔁 Return Pickup Scheduled",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "pickup_date"
    ],
    "text": "Hi {name}, pickup for your return request on order #{order_id} has been scheduled for {pickup_date}. Please keep the item packed and ready."
  },
  {
    "id": "tpl_txn_13",
    "name": "🔄 Exchange Request Approved",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "new_item"
    ],
    "text": "Dear {name}, your exchange request for order #{order_id} has been approved. Your new item ({new_item}) will be dispatched shortly."
  },
  {
    "id": "tpl_txn_14",
    "name": "🚛 Order Out for Delivery",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "rider_phone"
    ],
    "text": "Hi {name}, your order #{order_id} is out for delivery today! Rider contact: {rider_phone}. Please keep your phone accessible."
  },
  {
    "id": "tpl_txn_15",
    "name": "😔 Order Delay Apology",
    "category": "txn",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "new_date"
    ],
    "text": "Dear {name}, we're sorry for the delay in order #{order_id}. New expected delivery date: {new_date}. Thank you for your patience."
  },
  {
    "id": "tpl_support_1",
    "name": "💬 Instant WhatsApp Support",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "wa_link"
    ],
    "text": "Salam {name}! Need help with your account or order? Click here to chat with our official Pakistan WhatsApp customer care team: {wa_link} (Mon-Sat 9am-9pm)."
  },
  {
    "id": "tpl_support_2",
    "name": "🎫 Support Ticket Created",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "ticket_id"
    ],
    "text": "Hi {name}, your support ticket #{ticket_id} has been created. Our team will get back to you within 24 hours. Thank you for your patience."
  },
  {
    "id": "tpl_support_3",
    "name": "✅ Support Ticket Resolved",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "ticket_id"
    ],
    "text": "Dear {name}, your support ticket #{ticket_id} has been marked as resolved. Let us know if you need any further assistance."
  },
  {
    "id": "tpl_support_4",
    "name": "🟢 Live Chat Now Available",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Hi {name}, our live chat support is now online! Chat with an agent instantly here: {link}. We're happy to help."
  },
  {
    "id": "tpl_support_5",
    "name": "📲 Call Back Request Received",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "time_slot"
    ],
    "text": "Dear {name}, we've received your callback request. Our representative will contact you within {time_slot}. Thank you for reaching out."
  },
  {
    "id": "tpl_support_6",
    "name": "❓ Frequently Asked Questions",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "faq_link"
    ],
    "text": "Hi {name}, most common queries are answered here: {faq_link}. If you still need help, just reply to this message."
  },
  {
    "id": "tpl_support_7",
    "name": "📝 Complaint Acknowledged",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "complaint_id"
    ],
    "text": "Dear {name}, your complaint #{complaint_id} has been received and is under review. We aim to resolve it within 48 hours."
  },
  {
    "id": "tpl_support_8",
    "name": "🔺 Complaint Escalated",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "complaint_id",
      "manager"
    ],
    "text": "Hi {name}, your complaint #{complaint_id} has been escalated to our senior team member {manager} for faster resolution."
  },
  {
    "id": "tpl_support_9",
    "name": "🙏 Support Follow-Up",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "ticket_id"
    ],
    "text": "Dear {name}, just checking in — was your issue with ticket #{ticket_id} fully resolved? Reply YES or NO to let us know."
  },
  {
    "id": "tpl_support_10",
    "name": "📍 Nearest Store Locator",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "city",
      "link"
    ],
    "text": "Hi {name}, find our nearest branch in {city} here: {link}. Visit us for in-person assistance and product pickup."
  },
  {
    "id": "tpl_support_11",
    "name": "🛠️ Warranty Claim Registered",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "product",
      "claim_id"
    ],
    "text": "Dear {name}, your warranty claim for {product} has been registered under ID #{claim_id}. Our technician will contact you soon."
  },
  {
    "id": "tpl_support_12",
    "name": "🔧 Technician Visit Scheduled",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "date",
      "time"
    ],
    "text": "Hi {name}, a technician visit has been scheduled on {date} at {time} to resolve your reported issue. Please be available."
  },
  {
    "id": "tpl_support_13",
    "name": "📖 Product Manual & Guide",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "product",
      "link"
    ],
    "text": "Dear {name}, here's the user manual for your {product}: {link}. Let us know if you need any further guidance."
  },
  {
    "id": "tpl_support_14",
    "name": "🕒 Support Hours Update",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "new_hours"
    ],
    "text": "Hi {name}, please note our updated customer support hours: {new_hours}. We appreciate your understanding."
  },
  {
    "id": "tpl_support_15",
    "name": "⭐ Rate Your Support Experience",
    "category": "support",
    "isPreset": true,
    "variables": [
      "name",
      "ticket_id",
      "link"
    ],
    "text": "Dear {name}, how was your recent support experience with ticket #{ticket_id}? Rate us here: {link}. Your feedback matters!"
  },
  {
    "id": "tpl_alert_1",
    "name": "🔐 OTP / Login Verification Code",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "code",
      "app_name"
    ],
    "text": "Your {app_name} verification code is: {code}. Valid for 5 minutes. DO NOT share this secret OTP code with anyone, including customer support."
  },
  {
    "id": "tpl_alert_2",
    "name": "🔑 Password Reset Request",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "reset_link"
    ],
    "text": "Hi {name}, we received a request to reset your password. Click here to proceed: {reset_link}. If this wasn't you, please ignore this message."
  },
  {
    "id": "tpl_alert_3",
    "name": "📱 New Device Login Detected",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "device",
      "location",
      "time"
    ],
    "text": "Dear {name}, a new login was detected from {device} in {location} at {time}. If this wasn't you, secure your account immediately."
  },
  {
    "id": "tpl_alert_4",
    "name": "🚫 Account Suspended Notice",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "reason",
      "link"
    ],
    "text": "Dear {name}, your account has been temporarily suspended due to {reason}. Please contact support to resolve this: {link}."
  },
  {
    "id": "tpl_alert_5",
    "name": "🪪 KYC Verification Required",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "deadline",
      "link"
    ],
    "text": "Hi {name}, please complete your KYC verification by {deadline} to keep your account active. Verify now: {link}."
  },
  {
    "id": "tpl_alert_6",
    "name": "💰 Low Balance Alert",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "balance",
      "account"
    ],
    "text": "Dear {name}, your account {account} balance is running low at PKR {balance}. Please top up to avoid service interruption."
  },
  {
    "id": "tpl_alert_7",
    "name": "📄 Bill Due Alert",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "due_date"
    ],
    "text": "Hi {name}, your bill of PKR {amount} is due on {due_date}. Please pay on time to avoid a late fee."
  },
  {
    "id": "tpl_alert_8",
    "name": "🛑 Service Outage Notice",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "service",
      "area",
      "eta"
    ],
    "text": "Dear customer, {service} is currently experiencing an outage in {area}. Estimated restoration time: {eta}. We apologize for the inconvenience."
  },
  {
    "id": "tpl_alert_9",
    "name": "🚨 Suspicious Activity / Fraud Alert",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "account",
      "helpline"
    ],
    "text": "Dear {name}, we detected unusual activity on your {account} account. If this wasn't you, call our fraud helpline immediately: {helpline}."
  },
  {
    "id": "tpl_alert_10",
    "name": "💳 Card Blocked Notification",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "card_last4",
      "helpline"
    ],
    "text": "Dear {name}, your card ending {card_last4} has been temporarily blocked for security reasons. Call {helpline} to unblock."
  },
  {
    "id": "tpl_alert_11",
    "name": "🚪 Failed Delivery Attempt",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "reschedule_link"
    ],
    "text": "Hi {name}, our rider was unable to deliver order #{order_id} today. Reschedule your delivery here: {reschedule_link}."
  },
  {
    "id": "tpl_alert_12",
    "name": "✈️ Flight/Weather Delay Alert",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "flight_no",
      "new_time"
    ],
    "text": "Dear {name}, flight {flight_no} has been delayed. New estimated departure time: {new_time}. We regret the inconvenience."
  },
  {
    "id": "tpl_alert_13",
    "name": "🎓 Exam Result Announced",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "roll_no",
      "link"
    ],
    "text": "Dear {name}, results for roll number {roll_no} have been announced. Check your result here: {link}."
  },
  {
    "id": "tpl_alert_14",
    "name": "🔒 Security PIN Changed",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "time"
    ],
    "text": "Dear {name}, your account PIN was changed successfully at {time}. If you did not request this change, contact support immediately."
  },
  {
    "id": "tpl_alert_15",
    "name": "📶 Data/Package Expiry Alert",
    "category": "alert",
    "isPreset": true,
    "variables": [
      "name",
      "package",
      "expiry_date",
      "link"
    ],
    "text": "Hi {name}, your {package} package is expiring on {expiry_date}. Renew now to stay connected: {link}."
  },
  {
    "id": "tpl_reminder_1",
    "name": "📅 Appointment / Consultation Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "date",
      "time",
      "location"
    ],
    "text": "Hi {name}, this is a reminder of your scheduled appointment on {date} at {time} ({location}). Please reply or call if you need to reschedule."
  },
  {
    "id": "tpl_reminder_2",
    "name": "💳 Bill Payment Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "due_date",
      "pay_link"
    ],
    "text": "Dear {name}, a friendly reminder that PKR {amount} is due on {due_date}. Pay now to avoid late charges: {pay_link}."
  },
  {
    "id": "tpl_reminder_3",
    "name": "🔁 Subscription Renewal Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "plan",
      "date"
    ],
    "text": "Hi {name}, your {plan} subscription renews on {date}. No action needed if you wish to continue, otherwise contact us to cancel."
  },
  {
    "id": "tpl_reminder_4",
    "name": "💰 Installment Due Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "installment_no",
      "amount",
      "due_date"
    ],
    "text": "Dear {name}, installment #{installment_no} of PKR {amount} is due on {due_date}. Please make the payment on time to avoid penalty."
  },
  {
    "id": "tpl_reminder_5",
    "name": "👥 Meeting Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "topic",
      "date",
      "time"
    ],
    "text": "Hi {name}, reminder for your meeting on '{topic}' scheduled at {time} on {date}. Please join a few minutes early."
  },
  {
    "id": "tpl_reminder_6",
    "name": "🎟️ Event RSVP Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "deadline",
      "link"
    ],
    "text": "Dear {name}, please confirm your attendance for {event} by {deadline}. RSVP here: {link}."
  },
  {
    "id": "tpl_reminder_7",
    "name": "📄 Document Submission Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "document",
      "deadline"
    ],
    "text": "Hi {name}, please submit your {document} by {deadline} to avoid delays in processing your request."
  },
  {
    "id": "tpl_reminder_8",
    "name": "💉 Vaccination Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "vaccine",
      "date",
      "location"
    ],
    "text": "Dear {name}, your {vaccine} vaccination is due on {date} at {location}. Please bring your vaccination card."
  },
  {
    "id": "tpl_reminder_9",
    "name": "🚗 Vehicle Service Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "vehicle",
      "date",
      "workshop"
    ],
    "text": "Hi {name}, your {vehicle} is due for servicing on {date} at {workshop}. Book your slot in advance to avoid the rush."
  },
  {
    "id": "tpl_reminder_10",
    "name": "🏠 Rent Due Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "due_date"
    ],
    "text": "Dear {name}, your monthly rent of PKR {amount} is due on {due_date}. Kindly arrange the payment on time."
  },
  {
    "id": "tpl_reminder_11",
    "name": "🏦 Loan Installment Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "due_date"
    ],
    "text": "Hi {name}, your loan installment of PKR {amount} is due on {due_date}. Please ensure timely payment to maintain your credit standing."
  },
  {
    "id": "tpl_reminder_12",
    "name": "📝 Exam Date Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "subject",
      "date",
      "center"
    ],
    "text": "Dear {name}, your {subject} exam is scheduled on {date} at {center}. Best of luck with your preparation!"
  },
  {
    "id": "tpl_reminder_13",
    "name": "🛒 Cart Abandonment Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "product",
      "link"
    ],
    "text": "Hi {name}, you left {product} in your cart! Complete your purchase now before it sells out: {link}."
  },
  {
    "id": "tpl_reminder_14",
    "name": "⏰ Free Trial Ending Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "plan",
      "end_date",
      "link"
    ],
    "text": "Dear {name}, your free trial of {plan} ends on {end_date}. Upgrade now to keep enjoying all features: {link}."
  },
  {
    "id": "tpl_reminder_15",
    "name": "🏥 Follow-Up Visit Reminder",
    "category": "reminder",
    "isPreset": true,
    "variables": [
      "name",
      "doctor",
      "date",
      "time"
    ],
    "text": "Hi {name}, this is a reminder for your follow-up visit with Dr. {doctor} on {date} at {time}. See you soon!"
  },
  {
    "id": "tpl_feedback_1",
    "name": "⭐ Post-Purchase Review Request",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "product",
      "link"
    ],
    "text": "Hi {name}, how do you like your new {product}? We'd love to hear your feedback: {link}. It only takes a minute!"
  },
  {
    "id": "tpl_feedback_2",
    "name": "📊 NPS Satisfaction Survey",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Dear {name}, on a scale of 0-10, how likely are you to recommend us to a friend? Share your score: {link}."
  },
  {
    "id": "tpl_feedback_3",
    "name": "🌟 Service Rating Request",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "service",
      "link"
    ],
    "text": "Hi {name}, please rate your recent {service} experience with us: {link}. Your feedback helps us improve."
  },
  {
    "id": "tpl_feedback_4",
    "name": "📱 App Rating Request",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Dear {name}, enjoying our app so far? A quick 5-star rating would mean a lot to us: {link}."
  },
  {
    "id": "tpl_feedback_5",
    "name": "💡 Suggestion Box",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Hi {name}, got an idea to make our service better? We're all ears! Share your suggestions here: {link}."
  },
  {
    "id": "tpl_feedback_6",
    "name": "🙏 Complaint Resolution Feedback",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "ticket_id",
      "link"
    ],
    "text": "Dear {name}, now that ticket #{ticket_id} is resolved, how satisfied are you with the outcome? Let us know: {link}."
  },
  {
    "id": "tpl_feedback_7",
    "name": "🚚 Delivery Experience Feedback",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "order_id",
      "link"
    ],
    "text": "Hi {name}, how was your delivery experience for order #{order_id}? Rate our courier service here: {link}."
  },
  {
    "id": "tpl_feedback_8",
    "name": "🎉 Event Feedback Request",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "link"
    ],
    "text": "Dear {name}, thank you for attending {event}! We'd appreciate your feedback here: {link}."
  },
  {
    "id": "tpl_feedback_9",
    "name": "🧑‍💼 Employee Satisfaction Survey",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Hi {name}, please take a moment to complete our anonymous employee satisfaction survey: {link}. Your input matters."
  },
  {
    "id": "tpl_feedback_10",
    "name": "📣 Customer Testimonial Request",
    "category": "feedback",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Dear {name}, we'd be honored if you shared a short testimonial about your experience with us: {link}."
  },
  {
    "id": "tpl_hr_1",
    "name": "📋 Interview Invitation",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "position",
      "date",
      "time"
    ],
    "text": "Dear {name}, we're pleased to invite you for an interview for the {position} role on {date} at {time}. Please confirm your availability."
  },
  {
    "id": "tpl_hr_2",
    "name": "📨 Offer Letter Notice",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "position",
      "link"
    ],
    "text": "Congratulations {name}! We're excited to offer you the {position} role. Please review and sign your offer letter here: {link}."
  },
  {
    "id": "tpl_hr_3",
    "name": "👋 Onboarding Welcome Message",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "start_date",
      "manager"
    ],
    "text": "Welcome aboard {name}! Your first day is {start_date}. Your reporting manager will be {manager}. We're thrilled to have you!"
  },
  {
    "id": "tpl_hr_4",
    "name": "💵 Salary Credited Notification",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "month",
      "amount"
    ],
    "text": "Dear {name}, your salary for {month} amounting to PKR {amount} has been credited to your account. Thank you for your hard work!"
  },
  {
    "id": "tpl_hr_5",
    "name": "✅ Leave Request Approved",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "from_date",
      "to_date"
    ],
    "text": "Hi {name}, your leave request from {from_date} to {to_date} has been approved. Enjoy your time off!"
  },
  {
    "id": "tpl_hr_6",
    "name": "❌ Leave Request Rejected",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "from_date",
      "to_date",
      "reason"
    ],
    "text": "Dear {name}, your leave request from {from_date} to {to_date} could not be approved due to {reason}. Please contact HR for details."
  },
  {
    "id": "tpl_hr_7",
    "name": "📢 Company Policy Update",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "policy",
      "link"
    ],
    "text": "Hi {name}, our {policy} has been updated. Please review the changes here: {link} and acknowledge receipt."
  },
  {
    "id": "tpl_hr_8",
    "name": "🎓 Training Session Invitation",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "topic",
      "date",
      "time"
    ],
    "text": "Dear {name}, you're invited to a training session on '{topic}' on {date} at {time}. Attendance is highly encouraged."
  },
  {
    "id": "tpl_hr_9",
    "name": "📈 Performance Review Reminder",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "date"
    ],
    "text": "Hi {name}, your performance review is scheduled on {date}. Please complete your self-assessment form beforehand."
  },
  {
    "id": "tpl_hr_10",
    "name": "🤝 Resignation Acknowledgment",
    "category": "hr",
    "isPreset": true,
    "variables": [
      "name",
      "last_date"
    ],
    "text": "Dear {name}, we acknowledge receipt of your resignation. Your last working day is recorded as {last_date}. Wishing you the best ahead."
  },
  {
    "id": "tpl_event_1",
    "name": "🎥 Webinar Invitation",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "topic",
      "date",
      "link"
    ],
    "text": "Hi {name}, join our free webinar on '{topic}' on {date}. Register now to save your seat: {link}."
  },
  {
    "id": "tpl_event_2",
    "name": "🎫 Event Registration Confirmed",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "date"
    ],
    "text": "Dear {name}, your registration for {event} on {date} is confirmed. We look forward to seeing you there!"
  },
  {
    "id": "tpl_event_3",
    "name": "⏰ Event Reminder",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "date",
      "time"
    ],
    "text": "Hi {name}, just a reminder — {event} is happening on {date} at {time}. Don't miss it!"
  },
  {
    "id": "tpl_event_4",
    "name": "🎟️ Ticket Confirmation",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "ticket_id"
    ],
    "text": "Dear {name}, your ticket for {event} is confirmed. Ticket ID: {ticket_id}. Please keep it handy for entry."
  },
  {
    "id": "tpl_event_5",
    "name": "🚫 Event Cancelled Notice",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "reason"
    ],
    "text": "Dear {name}, we regret to inform you that {event} has been cancelled due to {reason}. We apologize for any inconvenience."
  },
  {
    "id": "tpl_event_6",
    "name": "🔄 Event Rescheduled Notice",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "new_date"
    ],
    "text": "Hi {name}, {event} has been rescheduled to {new_date}. Please update your calendar accordingly."
  },
  {
    "id": "tpl_event_7",
    "name": "🎤 Speaker Announcement",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "speaker"
    ],
    "text": "Dear {name}, we're excited to announce {speaker} as a keynote speaker at {event}. See you there!"
  },
  {
    "id": "tpl_event_8",
    "name": "🐦 Early Bird Pricing Ending",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "deadline",
      "link"
    ],
    "text": "Hi {name}, early bird pricing for {event} ends on {deadline}. Register now to save: {link}."
  },
  {
    "id": "tpl_event_9",
    "name": "📍 Venue Change Notice",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "new_venue"
    ],
    "text": "Dear {name}, please note the venue for {event} has changed to {new_venue}. Sorry for any inconvenience."
  },
  {
    "id": "tpl_event_10",
    "name": "🙏 Thank You for Attending",
    "category": "event",
    "isPreset": true,
    "variables": [
      "name",
      "event",
      "link"
    ],
    "text": "Hi {name}, thank you for attending {event}! We'd love your feedback: {link}."
  },
  {
    "id": "tpl_realestate_1",
    "name": "🏘️ New Property Listing Alert",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "area",
      "price",
      "link"
    ],
    "text": "Hi {name}, a new property in {area} just listed for PKR {price}. View details here: {link}."
  },
  {
    "id": "tpl_realestate_2",
    "name": "📍 Site Visit Confirmation",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "project",
      "date",
      "time"
    ],
    "text": "Dear {name}, your site visit for {project} is confirmed on {date} at {time}. Our agent will meet you there."
  },
  {
    "id": "tpl_realestate_3",
    "name": "✅ Booking Confirmation",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "unit",
      "project"
    ],
    "text": "Congratulations {name}! Your booking for unit {unit} in {project} has been confirmed. Our team will contact you regarding next steps."
  },
  {
    "id": "tpl_realestate_4",
    "name": "💰 Installment Plan Reminder",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "installment_no",
      "amount",
      "due_date"
    ],
    "text": "Dear {name}, installment #{installment_no} of PKR {amount} for your property is due on {due_date}."
  },
  {
    "id": "tpl_realestate_5",
    "name": "🔑 Possession Notice",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "unit",
      "date"
    ],
    "text": "Hi {name}, possession of your unit {unit} is scheduled for {date}. Please prepare the required documents."
  },
  {
    "id": "tpl_realestate_6",
    "name": "📉 Price Drop Alert",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "project",
      "new_price",
      "link"
    ],
    "text": "Dear {name}, great news! Prices at {project} have dropped to PKR {new_price}. Check it out: {link}."
  },
  {
    "id": "tpl_realestate_7",
    "name": "🏗️ New Project Launch",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "project",
      "location",
      "link"
    ],
    "text": "Hi {name}, we're excited to launch {project} in {location}! Explore floor plans & pricing: {link}."
  },
  {
    "id": "tpl_realestate_8",
    "name": "📞 Agent Contact Assigned",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "agent",
      "phone"
    ],
    "text": "Dear {name}, your dedicated property agent {agent} has been assigned. Contact them directly at {phone}."
  },
  {
    "id": "tpl_realestate_9",
    "name": "📄 Document Verification Required",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "deadline"
    ],
    "text": "Hi {name}, please submit your property documents for verification by {deadline} to avoid delays."
  },
  {
    "id": "tpl_realestate_10",
    "name": "💵 Token Payment Received",
    "category": "realestate",
    "isPreset": true,
    "variables": [
      "name",
      "unit",
      "amount"
    ],
    "text": "Dear {name}, we've received your token payment of PKR {amount} for unit {unit}. Thank you for choosing us!"
  },
  {
    "id": "tpl_bank_1",
    "name": "🏦 Account Opened Successfully",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "account_no"
    ],
    "text": "Dear {name}, your account #{account_no} has been opened successfully. Welcome, and thank you for banking with us!"
  },
  {
    "id": "tpl_bank_2",
    "name": "💳 Debit/Credit Card Dispatched",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "courier",
      "tracking_link"
    ],
    "text": "Hi {name}, your card has been dispatched via {courier}. Track delivery here: {tracking_link}."
  },
  {
    "id": "tpl_bank_3",
    "name": "✅ Loan Application Approved",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "link"
    ],
    "text": "Congratulations {name}! Your loan application for PKR {amount} has been approved. Next steps: {link}."
  },
  {
    "id": "tpl_bank_4",
    "name": "❌ Loan Application Rejected",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "reason"
    ],
    "text": "Dear {name}, unfortunately your loan application could not be approved due to {reason}. Contact us for more information."
  },
  {
    "id": "tpl_bank_5",
    "name": "📄 Account Statement Ready",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "month",
      "link"
    ],
    "text": "Hi {name}, your account statement for {month} is now ready. Download it here: {link}."
  },
  {
    "id": "tpl_bank_6",
    "name": "💸 Transaction Alert",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "account",
      "balance"
    ],
    "text": "Dear {name}, PKR {amount} was debited from account {account}. Available balance: PKR {balance}."
  },
  {
    "id": "tpl_bank_7",
    "name": "🚫 Cheque Bounced Notice",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "cheque_no",
      "reason"
    ],
    "text": "Dear {name}, your cheque #{cheque_no} has bounced due to {reason}. Please contact your branch for assistance."
  },
  {
    "id": "tpl_bank_8",
    "name": "📈 Fixed Deposit Maturity Notice",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "amount",
      "maturity_date"
    ],
    "text": "Hi {name}, your fixed deposit of PKR {amount} matures on {maturity_date}. Visit your branch to renew or withdraw."
  },
  {
    "id": "tpl_bank_9",
    "name": "⬆️ Credit Limit Increased",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "new_limit"
    ],
    "text": "Dear {name}, congratulations! Your credit card limit has been increased to PKR {new_limit}."
  },
  {
    "id": "tpl_bank_10",
    "name": "📱 Mobile Banking Activated",
    "category": "bank",
    "isPreset": true,
    "variables": [
      "name",
      "link"
    ],
    "text": "Hi {name}, your mobile banking service has been activated successfully. Login here: {link}."
  }
];
