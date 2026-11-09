/* ---------------------------------------------------------------------------
   NEXORA — shared domain types (mirror the PostgreSQL schema exactly)
--------------------------------------------------------------------------- */

export type AppRole = 'admin' | 'staff' | 'customer'

export type OrderStatus =
  | 'pending_payment'
  | 'payment_submitted'
  | 'payment_verified'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type PaymentMethod = 'bkash' | 'nagad' | 'bank_transfer'
export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'rejected'
export type Availability = 'in_stock' | 'limited' | 'out_of_stock'
export type CouponType = 'percentage' | 'fixed'
export type SupportStatus = 'open' | 'replied' | 'closed'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  avatar_url: string | null
  is_blocked?: boolean
  created_at: string
  updated_at?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image_url: string | null
  accent: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string
  brand: string | null
  short_description: string | null
  description: string | null
  image_url: string | null
  gallery: string[]
  duration: string
  original_price: number
  discounted_price: number
  delivery_info: string | null
  delivery_time: string | null
  availability: Availability
  is_featured: boolean
  is_active: boolean
  badge: string | null
  rating: number | null
  rating_count: number
  sales_count: number
  sort_order: number
  admin_note?: string | null
  created_at: string
  updated_at?: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  product_image: string | null
  duration: string | null
  unit_price: number
  quantity: number
  line_total: number
  created_at?: string
}

export interface Payment {
  id: string
  order_id: string
  method: PaymentMethod
  amount: number
  sender_number: string | null
  transaction_id: string | null
  proof_url: string | null
  status: PaymentStatus
  admin_note?: string | null
  verified_at: string | null
  created_at: string
}

export interface StatusEvent {
  status: OrderStatus
  note: string | null
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_note: string | null
  subtotal: number
  discount: number
  total: number
  coupon_code: string | null
  payment_method: PaymentMethod
  status: OrderStatus
  admin_note?: string | null
  created_at: string
  updated_at?: string
  /** joined client-side */
  order_items?: OrderItem[]
  payments?: Payment[]
}

export interface OrderDetail {
  order: Order
  items: OrderItem[]
  payment: Payment | null
  history: StatusEvent[]
}

export interface PaymentMethodConfig {
  id: string
  method: PaymentMethod
  display_name: string
  account_name: string | null
  account_number: string
  account_type: string | null
  bank_name: string | null
  branch: string | null
  routing_number: string | null
  instructions: string | null
  is_active: boolean
  sort_order: number
}

export interface Promotion {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  image_url: string | null
  badge: string | null
  cta_label: string | null
  cta_link: string | null
  discount_text: string | null
  is_active: boolean
  sort_order: number
}

export interface Faq {
  id: string
  question: string
  answer: string
  category: string | null
  sort_order: number
  is_active: boolean
}

export interface Review {
  id: string
  customer_name: string
  customer_city: string | null
  rating: number
  comment: string
  avatar_url: string | null
  is_approved: boolean
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  type: CouponType
  value: number
  min_order: number
  max_discount: number | null
  usage_limit: number | null
  used_count: number
  starts_at: string
  expires_at: string | null
  is_active: boolean
}

export interface SupportMessage {
  id: string
  user_id: string | null
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
  order_number: string | null
  status: SupportStatus
  admin_reply: string | null
  replied_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  order_id: string | null
  is_read: boolean
  created_at: string
}

export interface SiteSettings {
  site: {
    name: string
    tagline: string
    hero_headline: string
    hero_subtitle: string
    hero_cta: string
    hero_banner: string
  }
  contact: {
    whatsapp: string
    phone: string
    email: string
    address: string
    hours: string
    facebook: string
    messenger: string
  }
  notices: {
    announcement: string
    announcement_active: boolean
    checkout_note: string
    support_note: string
  }
  seo: { title: string; description: string; keywords: string }
  trust: { items: { title: string; text: string }[] }
  rewards: { referral_note: string; warranty_days: number }
}

export interface DashboardStats {
  total_sales: number
  total_orders: number
  pending_orders: number
  completed_orders: number
  total_customers: number
  total_products: number
  unread_notifications: number
  open_support: number
  revenue_today: number
  orders_today: number
  sales_series: { day: string; total: number }[]
}

/* -------- cart / checkout -------- */
export interface CartLine {
  productId: string
  slug: string
  name: string
  image_url: string | null
  brand: string | null
  duration: string
  unitPrice: number
  originalPrice: number
  quantity: number
  availability: Availability
}

export interface CheckoutDetails {
  fullName: string
  email: string
  phone: string
  note?: string
  paymentMethod: PaymentMethod
  couponCode?: string
}

export interface PlacedOrder {
  orderId: string
  orderNumber: string
  accessToken: string
  total: number
  subtotal: number
  discount: number
}

/* -------- catalogue query -------- */
export interface ProductQuery {
  search?: string
  categorySlug?: string
  categoryId?: string
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'popular' | 'discount'
  minPrice?: number
  maxPrice?: number
  availability?: Availability | 'all'
  featuredOnly?: boolean
  page?: number
  perPage?: number
}

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  perPage: number
}
