/**
 * seedoftemplate.js
 * ------------------------------------------------------------
 * Seeds 100–200 ready-to-use WhatsApp/SMS business message
 * templates (Pakistani business context) into a JSON + JS file.
 *
 * Usage:
 *   node seedoftemplate.js
 *
 * Output:
 *   ./seed-output/templates.generated.json
 *   ./seed-output/templates.generated.js   (CommonJS export)
 *
 * Each template record shape:
 *   {
 *     id: string,
 *     name: string,
 *     category: string,
 *     isPreset: boolean,
 *     variables: string[],
 *     text: string,
 *   }
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

/** Helper to build a category's template list with less boilerplate.
 * row = [idSuffix, name, variables[], text]
 */
function buildCategory(category, rows) {
  return rows.map(([idSuffix, name, variables, text]) => ({
    id: `tpl_${category}_${idSuffix}`,
    name,
    category,
    isPreset: true,
    variables,
    text,
  }));
}

/* ------------------------------ PROMOTIONAL (15) ------------------------------ */
const promotional = buildCategory("promo", [
  [1, "⚡ Flash Sale & Discount Code", ["name", "discount", "code", "link"],
    "Salam {name}! Exclusive MEGA SALE: Enjoy FLAT {discount}% OFF on all products today only. Shop online: {link} Use coupon code: {code}. Express delivery all over Pakistan! 🇵🇰"],
  [2, "🆕 New Arrival Announcement", ["name", "product", "link"],
    "Hi {name}, guess what just landed? {product} is now live on our store! Be the first to grab it: {link}. Limited stock available."],
  [3, "🌙 Eid Sale Special", ["name", "discount", "link"],
    "Eid Mubarak {name}! Celebrate with us — get {discount}% OFF storewide this Eid season. Shop now: {link}. Offer valid for a limited time only."],
  [4, "🕌 Ramadan Mega Offer", ["name", "discount", "link"],
    "Ramadan Kareem {name}! Enjoy {discount}% OFF on Iftar & Sehri essentials all month long. Order here: {link}. Free delivery on orders above PKR 1500."],
  [5, "🎁 Bundle Deal Offer", ["name", "bundle_name", "price", "link"],
    "Hi {name}, save more with our {bundle_name} combo deal — now just PKR {price}! Grab the bundle before it's gone: {link}."],
  [6, "🚚 Free Delivery Weekend", ["name", "city", "link"],
    "Good news {name}! Enjoy FREE home delivery in {city} this weekend on all orders. Order now: {link}. No minimum purchase required."],
  [7, "🤝 Referral Bonus Offer", ["name", "reward", "ref_link"],
    "Hi {name}, invite your friends & earn {reward} for every successful referral! Share your link: {ref_link} and start earning today."],
  [8, "⭐ Loyalty Points Update", ["name", "points", "link"],
    "Dear {name}, you now have {points} loyalty points in your wallet! Redeem them on your next purchase: {link}. Points expire soon, don't miss out."],
  [9, "🏷️ Clearance Sale Alert", ["name", "discount", "link"],
    "Salam {name}! Our biggest CLEARANCE sale is here — up to {discount}% OFF on selected items. Shop before stock runs out: {link}."],
  [10, "🎉 Weekend Special Offer", ["name", "discount", "link"],
    "Hi {name}, weekend vibes call for weekend savings! Get {discount}% OFF this Saturday & Sunday only. Shop now: {link}."],
  [11, "🎯 First Order Discount", ["name", "discount", "code", "link"],
    "Welcome {name}! As a first-time customer, enjoy {discount}% OFF your first order using code {code}. Start shopping: {link}."],
  [12, "💰 Cashback Offer", ["name", "cashback", "link"],
    "Hi {name}, get PKR {cashback} cashback on your next order via Easypaisa/JazzCash! Shop now: {link}. Offer valid for a limited time."],
  [13, "💳 Bank Card Discount", ["name", "bank", "discount", "link"],
    "Salam {name}! Pay with your {bank} card and get an extra {discount}% OFF instantly. Shop here: {link}."],
  [14, "🛍️ Buy 1 Get 1 Free", ["name", "category_name", "link"],
    "Hi {name}, our Buy 1 Get 1 FREE offer on {category_name} is now live! Grab yours before it ends: {link}."],
  [15, "🇵🇰 Independence Day Sale", ["name", "discount", "link"],
    "Happy Independence Day {name}! Celebrate 14 August with {discount}% OFF storewide. Shop the Jashn-e-Azadi sale: {link}."],
]);

/* ------------------------------ TRANSACTIONAL (15) ------------------------------ */
const transactional = buildCategory("txn", [
  [1, "✅ Order Confirmed", ["name", "order_id", "amount"],
    "Dear {name}, your order #{order_id} worth PKR {amount} has been confirmed. We will notify you once it's shipped. Thank you for shopping with us!"],
  [2, "📦 Order Dispatched & Live Tracking", ["name", "order_id", "courier", "tracking_link"],
    "Dear {name}, your order #{order_id} has been dispatched via {courier}! Track your parcel delivery here: {tracking_link} . Expected delivery within 24-48 hours."],
  [3, "🏠 Order Delivered Successfully", ["name", "order_id"],
    "Hi {name}, your order #{order_id} has been delivered successfully. We hope you love it! Please rate your experience whenever you get a chance."],
  [4, "❌ Order Cancelled Confirmation", ["name", "order_id", "reason"],
    "Dear {name}, your order #{order_id} has been cancelled. Reason: {reason}. If this was a mistake, please contact our support team immediately."],
  [5, "💵 Refund Processed", ["name", "order_id", "amount", "days"],
    "Hi {name}, a refund of PKR {amount} for order #{order_id} has been processed. It will reflect in your account within {days} business days."],
  [6, "🧾 Payment Received", ["name", "amount", "order_id"],
    "Dear {name}, we have received your payment of PKR {amount} for order #{order_id}. Your order is now being processed. Thank you!"],
  [7, "⚠️ Payment Failed Notice", ["name", "order_id", "retry_link"],
    "Hi {name}, your payment for order #{order_id} could not be processed. Please retry using this link: {retry_link} to confirm your order."],
  [8, "📞 COD Order Confirmation Call", ["name", "order_id", "phone"],
    "Dear {name}, please confirm your Cash on Delivery order #{order_id}. Our team will call you on {phone} shortly to verify the details."],
  [9, "💳 Invoice & Payment Reminder", ["name", "invoice_no", "amount", "due_date", "pay_link"],
    "Reminder for {name}: Invoice #{invoice_no} amounting to PKR {amount} is due on {due_date}. Pay securely via Easypaisa/JazzCash/Bank at: {pay_link}. Thank you!"],
  [10, "🔄 Subscription Renewed", ["name", "plan", "amount", "next_date"],
    "Hi {name}, your {plan} subscription has been renewed for PKR {amount}. Next renewal date: {next_date}. Thank you for staying with us!"],
  [11, "⏳ Subscription Expiring Soon", ["name", "plan", "expiry_date", "link"],
    "Dear {name}, your {plan} subscription is expiring on {expiry_date}. Renew now to avoid interruption: {link}."],
  [12, "🔁 Return Pickup Scheduled", ["name", "order_id", "pickup_date"],
    "Hi {name}, pickup for your return request on order #{order_id} has been scheduled for {pickup_date}. Please keep the item packed and ready."],
  [13, "🔄 Exchange Request Approved", ["name", "order_id", "new_item"],
    "Dear {name}, your exchange request for order #{order_id} has been approved. Your new item ({new_item}) will be dispatched shortly."],
  [14, "🚛 Order Out for Delivery", ["name", "order_id", "rider_phone"],
    "Hi {name}, your order #{order_id} is out for delivery today! Rider contact: {rider_phone}. Please keep your phone accessible."],
  [15, "😔 Order Delay Apology", ["name", "order_id", "new_date"],
    "Dear {name}, we're sorry for the delay in order #{order_id}. New expected delivery date: {new_date}. Thank you for your patience."],
]);

/* ------------------------------ SUPPORT (15) ------------------------------ */
const support = buildCategory("support", [
  [1, "💬 Instant WhatsApp Support", ["name", "wa_link"],
    "Salam {name}! Need help with your account or order? Click here to chat with our official Pakistan WhatsApp customer care team: {wa_link} (Mon-Sat 9am-9pm)."],
  [2, "🎫 Support Ticket Created", ["name", "ticket_id"],
    "Hi {name}, your support ticket #{ticket_id} has been created. Our team will get back to you within 24 hours. Thank you for your patience."],
  [3, "✅ Support Ticket Resolved", ["name", "ticket_id"],
    "Dear {name}, your support ticket #{ticket_id} has been marked as resolved. Let us know if you need any further assistance."],
  [4, "🟢 Live Chat Now Available", ["name", "link"],
    "Hi {name}, our live chat support is now online! Chat with an agent instantly here: {link}. We're happy to help."],
  [5, "📲 Call Back Request Received", ["name", "time_slot"],
    "Dear {name}, we've received your callback request. Our representative will contact you within {time_slot}. Thank you for reaching out."],
  [6, "❓ Frequently Asked Questions", ["name", "faq_link"],
    "Hi {name}, most common queries are answered here: {faq_link}. If you still need help, just reply to this message."],
  [7, "📝 Complaint Acknowledged", ["name", "complaint_id"],
    "Dear {name}, your complaint #{complaint_id} has been received and is under review. We aim to resolve it within 48 hours."],
  [8, "🔺 Complaint Escalated", ["name", "complaint_id", "manager"],
    "Hi {name}, your complaint #{complaint_id} has been escalated to our senior team member {manager} for faster resolution."],
  [9, "🙏 Support Follow-Up", ["name", "ticket_id"],
    "Dear {name}, just checking in — was your issue with ticket #{ticket_id} fully resolved? Reply YES or NO to let us know."],
  [10, "📍 Nearest Store Locator", ["name", "city", "link"],
    "Hi {name}, find our nearest branch in {city} here: {link}. Visit us for in-person assistance and product pickup."],
  [11, "🛠️ Warranty Claim Registered", ["name", "product", "claim_id"],
    "Dear {name}, your warranty claim for {product} has been registered under ID #{claim_id}. Our technician will contact you soon."],
  [12, "🔧 Technician Visit Scheduled", ["name", "date", "time"],
    "Hi {name}, a technician visit has been scheduled on {date} at {time} to resolve your reported issue. Please be available."],
  [13, "📖 Product Manual & Guide", ["name", "product", "link"],
    "Dear {name}, here's the user manual for your {product}: {link}. Let us know if you need any further guidance."],
  [14, "🕒 Support Hours Update", ["name", "new_hours"],
    "Hi {name}, please note our updated customer support hours: {new_hours}. We appreciate your understanding."],
  [15, "⭐ Rate Your Support Experience", ["name", "ticket_id", "link"],
    "Dear {name}, how was your recent support experience with ticket #{ticket_id}? Rate us here: {link}. Your feedback matters!"],
]);

/* ------------------------------ ALERTS (15) ------------------------------ */
const alerts = buildCategory("alert", [
  [1, "🔐 OTP / Login Verification Code", ["code", "app_name"],
    "Your {app_name} verification code is: {code}. Valid for 5 minutes. DO NOT share this secret OTP code with anyone, including customer support."],
  [2, "🔑 Password Reset Request", ["name", "reset_link"],
    "Hi {name}, we received a request to reset your password. Click here to proceed: {reset_link}. If this wasn't you, please ignore this message."],
  [3, "📱 New Device Login Detected", ["name", "device", "location", "time"],
    "Dear {name}, a new login was detected from {device} in {location} at {time}. If this wasn't you, secure your account immediately."],
  [4, "🚫 Account Suspended Notice", ["name", "reason", "link"],
    "Dear {name}, your account has been temporarily suspended due to {reason}. Please contact support to resolve this: {link}."],
  [5, "🪪 KYC Verification Required", ["name", "deadline", "link"],
    "Hi {name}, please complete your KYC verification by {deadline} to keep your account active. Verify now: {link}."],
  [6, "💰 Low Balance Alert", ["name", "balance", "account"],
    "Dear {name}, your account {account} balance is running low at PKR {balance}. Please top up to avoid service interruption."],
  [7, "📄 Bill Due Alert", ["name", "amount", "due_date"],
    "Hi {name}, your bill of PKR {amount} is due on {due_date}. Please pay on time to avoid a late fee."],
  [8, "🛑 Service Outage Notice", ["service", "area", "eta"],
    "Dear customer, {service} is currently experiencing an outage in {area}. Estimated restoration time: {eta}. We apologize for the inconvenience."],
  [9, "🚨 Suspicious Activity / Fraud Alert", ["name", "account", "helpline"],
    "Dear {name}, we detected unusual activity on your {account} account. If this wasn't you, call our fraud helpline immediately: {helpline}."],
  [10, "💳 Card Blocked Notification", ["name", "card_last4", "helpline"],
    "Dear {name}, your card ending {card_last4} has been temporarily blocked for security reasons. Call {helpline} to unblock."],
  [11, "🚪 Failed Delivery Attempt", ["name", "order_id", "reschedule_link"],
    "Hi {name}, our rider was unable to deliver order #{order_id} today. Reschedule your delivery here: {reschedule_link}."],
  [12, "✈️ Flight/Weather Delay Alert", ["name", "flight_no", "new_time"],
    "Dear {name}, flight {flight_no} has been delayed. New estimated departure time: {new_time}. We regret the inconvenience."],
  [13, "🎓 Exam Result Announced", ["name", "roll_no", "link"],
    "Dear {name}, results for roll number {roll_no} have been announced. Check your result here: {link}."],
  [14, "🔒 Security PIN Changed", ["name", "time"],
    "Dear {name}, your account PIN was changed successfully at {time}. If you did not request this change, contact support immediately."],
  [15, "📶 Data/Package Expiry Alert", ["name", "package", "expiry_date", "link"],
    "Hi {name}, your {package} package is expiring on {expiry_date}. Renew now to stay connected: {link}."],
]);

/* ------------------------------ REMINDERS (15) ------------------------------ */
const reminders = buildCategory("reminder", [
  [1, "📅 Appointment / Consultation Reminder", ["name", "date", "time", "location"],
    "Hi {name}, this is a reminder of your scheduled appointment on {date} at {time} ({location}). Please reply or call if you need to reschedule."],
  [2, "💳 Bill Payment Reminder", ["name", "amount", "due_date", "pay_link"],
    "Dear {name}, a friendly reminder that PKR {amount} is due on {due_date}. Pay now to avoid late charges: {pay_link}."],
  [3, "🔁 Subscription Renewal Reminder", ["name", "plan", "date"],
    "Hi {name}, your {plan} subscription renews on {date}. No action needed if you wish to continue, otherwise contact us to cancel."],
  [4, "💰 Installment Due Reminder", ["name", "installment_no", "amount", "due_date"],
    "Dear {name}, installment #{installment_no} of PKR {amount} is due on {due_date}. Please make the payment on time to avoid penalty."],
  [5, "👥 Meeting Reminder", ["name", "topic", "date", "time"],
    "Hi {name}, reminder for your meeting on '{topic}' scheduled at {time} on {date}. Please join a few minutes early."],
  [6, "🎟️ Event RSVP Reminder", ["name", "event", "deadline", "link"],
    "Dear {name}, please confirm your attendance for {event} by {deadline}. RSVP here: {link}."],
  [7, "📄 Document Submission Reminder", ["name", "document", "deadline"],
    "Hi {name}, please submit your {document} by {deadline} to avoid delays in processing your request."],
  [8, "💉 Vaccination Reminder", ["name", "vaccine", "date", "location"],
    "Dear {name}, your {vaccine} vaccination is due on {date} at {location}. Please bring your vaccination card."],
  [9, "🚗 Vehicle Service Reminder", ["name", "vehicle", "date", "workshop"],
    "Hi {name}, your {vehicle} is due for servicing on {date} at {workshop}. Book your slot in advance to avoid the rush."],
  [10, "🏠 Rent Due Reminder", ["name", "amount", "due_date"],
    "Dear {name}, your monthly rent of PKR {amount} is due on {due_date}. Kindly arrange the payment on time."],
  [11, "🏦 Loan Installment Reminder", ["name", "amount", "due_date"],
    "Hi {name}, your loan installment of PKR {amount} is due on {due_date}. Please ensure timely payment to maintain your credit standing."],
  [12, "📝 Exam Date Reminder", ["name", "subject", "date", "center"],
    "Dear {name}, your {subject} exam is scheduled on {date} at {center}. Best of luck with your preparation!"],
  [13, "🛒 Cart Abandonment Reminder", ["name", "product", "link"],
    "Hi {name}, you left {product} in your cart! Complete your purchase now before it sells out: {link}."],
  [14, "⏰ Free Trial Ending Reminder", ["name", "plan", "end_date", "link"],
    "Dear {name}, your free trial of {plan} ends on {end_date}. Upgrade now to keep enjoying all features: {link}."],
  [15, "🏥 Follow-Up Visit Reminder", ["name", "doctor", "date", "time"],
    "Hi {name}, this is a reminder for your follow-up visit with Dr. {doctor} on {date} at {time}. See you soon!"],
]);

/* ------------------------------ FEEDBACK (10) ------------------------------ */
const feedback = buildCategory("feedback", [
  [1, "⭐ Post-Purchase Review Request", ["name", "product", "link"],
    "Hi {name}, how do you like your new {product}? We'd love to hear your feedback: {link}. It only takes a minute!"],
  [2, "📊 NPS Satisfaction Survey", ["name", "link"],
    "Dear {name}, on a scale of 0-10, how likely are you to recommend us to a friend? Share your score: {link}."],
  [3, "🌟 Service Rating Request", ["name", "service", "link"],
    "Hi {name}, please rate your recent {service} experience with us: {link}. Your feedback helps us improve."],
  [4, "📱 App Rating Request", ["name", "link"],
    "Dear {name}, enjoying our app so far? A quick 5-star rating would mean a lot to us: {link}."],
  [5, "💡 Suggestion Box", ["name", "link"],
    "Hi {name}, got an idea to make our service better? We're all ears! Share your suggestions here: {link}."],
  [6, "🙏 Complaint Resolution Feedback", ["name", "ticket_id", "link"],
    "Dear {name}, now that ticket #{ticket_id} is resolved, how satisfied are you with the outcome? Let us know: {link}."],
  [7, "🚚 Delivery Experience Feedback", ["name", "order_id", "link"],
    "Hi {name}, how was your delivery experience for order #{order_id}? Rate our courier service here: {link}."],
  [8, "🎉 Event Feedback Request", ["name", "event", "link"],
    "Dear {name}, thank you for attending {event}! We'd appreciate your feedback here: {link}."],
  [9, "🧑‍💼 Employee Satisfaction Survey", ["name", "link"],
    "Hi {name}, please take a moment to complete our anonymous employee satisfaction survey: {link}. Your input matters."],
  [10, "📣 Customer Testimonial Request", ["name", "link"],
    "Dear {name}, we'd be honored if you shared a short testimonial about your experience with us: {link}."],
]);

/* ------------------------------ HR / INTERNAL (10) ------------------------------ */
const hr = buildCategory("hr", [
  [1, "📋 Interview Invitation", ["name", "position", "date", "time"],
    "Dear {name}, we're pleased to invite you for an interview for the {position} role on {date} at {time}. Please confirm your availability."],
  [2, "📨 Offer Letter Notice", ["name", "position", "link"],
    "Congratulations {name}! We're excited to offer you the {position} role. Please review and sign your offer letter here: {link}."],
  [3, "👋 Onboarding Welcome Message", ["name", "start_date", "manager"],
    "Welcome aboard {name}! Your first day is {start_date}. Your reporting manager will be {manager}. We're thrilled to have you!"],
  [4, "💵 Salary Credited Notification", ["name", "month", "amount"],
    "Dear {name}, your salary for {month} amounting to PKR {amount} has been credited to your account. Thank you for your hard work!"],
  [5, "✅ Leave Request Approved", ["name", "from_date", "to_date"],
    "Hi {name}, your leave request from {from_date} to {to_date} has been approved. Enjoy your time off!"],
  [6, "❌ Leave Request Rejected", ["name", "from_date", "to_date", "reason"],
    "Dear {name}, your leave request from {from_date} to {to_date} could not be approved due to {reason}. Please contact HR for details."],
  [7, "📢 Company Policy Update", ["name", "policy", "link"],
    "Hi {name}, our {policy} has been updated. Please review the changes here: {link} and acknowledge receipt."],
  [8, "🎓 Training Session Invitation", ["name", "topic", "date", "time"],
    "Dear {name}, you're invited to a training session on '{topic}' on {date} at {time}. Attendance is highly encouraged."],
  [9, "📈 Performance Review Reminder", ["name", "date"],
    "Hi {name}, your performance review is scheduled on {date}. Please complete your self-assessment form beforehand."],
  [10, "🤝 Resignation Acknowledgment", ["name", "last_date"],
    "Dear {name}, we acknowledge receipt of your resignation. Your last working day is recorded as {last_date}. Wishing you the best ahead."],
]);

/* ------------------------------ EVENTS (10) ------------------------------ */
const events = buildCategory("event", [
  [1, "🎥 Webinar Invitation", ["name", "topic", "date", "link"],
    "Hi {name}, join our free webinar on '{topic}' on {date}. Register now to save your seat: {link}."],
  [2, "🎫 Event Registration Confirmed", ["name", "event", "date"],
    "Dear {name}, your registration for {event} on {date} is confirmed. We look forward to seeing you there!"],
  [3, "⏰ Event Reminder", ["name", "event", "date", "time"],
    "Hi {name}, just a reminder — {event} is happening on {date} at {time}. Don't miss it!"],
  [4, "🎟️ Ticket Confirmation", ["name", "event", "ticket_id"],
    "Dear {name}, your ticket for {event} is confirmed. Ticket ID: {ticket_id}. Please keep it handy for entry."],
  [5, "🚫 Event Cancelled Notice", ["name", "event", "reason"],
    "Dear {name}, we regret to inform you that {event} has been cancelled due to {reason}. We apologize for any inconvenience."],
  [6, "🔄 Event Rescheduled Notice", ["name", "event", "new_date"],
    "Hi {name}, {event} has been rescheduled to {new_date}. Please update your calendar accordingly."],
  [7, "🎤 Speaker Announcement", ["name", "event", "speaker"],
    "Dear {name}, we're excited to announce {speaker} as a keynote speaker at {event}. See you there!"],
  [8, "🐦 Early Bird Pricing Ending", ["name", "event", "deadline", "link"],
    "Hi {name}, early bird pricing for {event} ends on {deadline}. Register now to save: {link}."],
  [9, "📍 Venue Change Notice", ["name", "event", "new_venue"],
    "Dear {name}, please note the venue for {event} has changed to {new_venue}. Sorry for any inconvenience."],
  [10, "🙏 Thank You for Attending", ["name", "event", "link"],
    "Hi {name}, thank you for attending {event}! We'd love your feedback: {link}."],
]);

/* ------------------------------ REAL ESTATE (10) ------------------------------ */
const realestate = buildCategory("realestate", [
  [1, "🏘️ New Property Listing Alert", ["name", "area", "price", "link"],
    "Hi {name}, a new property in {area} just listed for PKR {price}. View details here: {link}."],
  [2, "📍 Site Visit Confirmation", ["name", "project", "date", "time"],
    "Dear {name}, your site visit for {project} is confirmed on {date} at {time}. Our agent will meet you there."],
  [3, "✅ Booking Confirmation", ["name", "unit", "project"],
    "Congratulations {name}! Your booking for unit {unit} in {project} has been confirmed. Our team will contact you regarding next steps."],
  [4, "💰 Installment Plan Reminder", ["name", "installment_no", "amount", "due_date"],
    "Dear {name}, installment #{installment_no} of PKR {amount} for your property is due on {due_date}."],
  [5, "🔑 Possession Notice", ["name", "unit", "date"],
    "Hi {name}, possession of your unit {unit} is scheduled for {date}. Please prepare the required documents."],
  [6, "📉 Price Drop Alert", ["name", "project", "new_price", "link"],
    "Dear {name}, great news! Prices at {project} have dropped to PKR {new_price}. Check it out: {link}."],
  [7, "🏗️ New Project Launch", ["name", "project", "location", "link"],
    "Hi {name}, we're excited to launch {project} in {location}! Explore floor plans & pricing: {link}."],
  [8, "📞 Agent Contact Assigned", ["name", "agent", "phone"],
    "Dear {name}, your dedicated property agent {agent} has been assigned. Contact them directly at {phone}."],
  [9, "📄 Document Verification Required", ["name", "deadline"],
    "Hi {name}, please submit your property documents for verification by {deadline} to avoid delays."],
  [10, "💵 Token Payment Received", ["name", "unit", "amount"],
    "Dear {name}, we've received your token payment of PKR {amount} for unit {unit}. Thank you for choosing us!"],
]);

/* ------------------------------ BANKING / FINANCE (10) ------------------------------ */
const banking = buildCategory("bank", [
  [1, "🏦 Account Opened Successfully", ["name", "account_no"],
    "Dear {name}, your account #{account_no} has been opened successfully. Welcome, and thank you for banking with us!"],
  [2, "💳 Debit/Credit Card Dispatched", ["name", "courier", "tracking_link"],
    "Hi {name}, your card has been dispatched via {courier}. Track delivery here: {tracking_link}."],
  [3, "✅ Loan Application Approved", ["name", "amount", "link"],
    "Congratulations {name}! Your loan application for PKR {amount} has been approved. Next steps: {link}."],
  [4, "❌ Loan Application Rejected", ["name", "reason"],
    "Dear {name}, unfortunately your loan application could not be approved due to {reason}. Contact us for more information."],
  [5, "📄 Account Statement Ready", ["name", "month", "link"],
    "Hi {name}, your account statement for {month} is now ready. Download it here: {link}."],
  [6, "💸 Transaction Alert", ["name", "amount", "account", "balance"],
    "Dear {name}, PKR {amount} was debited from account {account}. Available balance: PKR {balance}."],
  [7, "🚫 Cheque Bounced Notice", ["name", "cheque_no", "reason"],
    "Dear {name}, your cheque #{cheque_no} has bounced due to {reason}. Please contact your branch for assistance."],
  [8, "📈 Fixed Deposit Maturity Notice", ["name", "amount", "maturity_date"],
    "Hi {name}, your fixed deposit of PKR {amount} matures on {maturity_date}. Visit your branch to renew or withdraw."],
  [9, "⬆️ Credit Limit Increased", ["name", "new_limit"],
    "Dear {name}, congratulations! Your credit card limit has been increased to PKR {new_limit}."],
  [10, "📱 Mobile Banking Activated", ["name", "link"],
    "Hi {name}, your mobile banking service has been activated successfully. Login here: {link}."],
]);

/* ------------------------------ Combine all ------------------------------ */
const DEFAULT_TEMPLATES = [
  ...promotional,
  ...transactional,
  ...support,
  ...alerts,
  ...reminders,
  ...feedback,
  ...hr,
  ...events,
  ...realestate,
  ...banking,
];

/* ------------------------------ Run as script ------------------------------ */
if (require.main === module) {
  const outDir = path.join(__dirname, "seed-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "templates.generated.json");
  const jsPath = path.join(outDir, "templates.generated.js");

  fs.writeFileSync(jsonPath, JSON.stringify(DEFAULT_TEMPLATES, null, 2), "utf-8");
  fs.writeFileSync(
    jsPath,
    `// Auto-generated by seedoftemplate.js on ${new Date().toISOString()}\nmodule.exports = ${JSON.stringify(
      DEFAULT_TEMPLATES,
      null,
      2
    )};\n`,
    "utf-8"
  );

  const counts = DEFAULT_TEMPLATES.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`✅ Seeded ${DEFAULT_TEMPLATES.length} templates across ${Object.keys(counts).length} categories.`);
  Object.entries(counts).forEach(([cat, count]) => console.log(`   - ${cat}: ${count}`));
  console.log(`\n📄 JSON written to: ${jsonPath}`);
  console.log(`📄 JS module written to: ${jsPath}`);
}

module.exports = { DEFAULT_TEMPLATES };