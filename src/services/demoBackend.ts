/* ---------------------------------------------------------------------------
   Offline demo backend
   ---------------------------------------------------------------------------
   Used ONLY when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
   It reproduces the same contract as the Supabase data layer (src/services/*)
   using localStorage, so the whole product — cart, checkout, manual payment
   submission, order tracking, admin verification — can be exercised and tested
   before a real project exists.

   It is deliberately a *stand-in*, not a fake success path: it enforces the
   same business rules (server-side re-pricing, one payment submission per
   order, admin-only transitions) and it is labelled as demo mode in the UI.
--------------------------------------------------------------------------- */
import type {
  Category,
  Coupon,
  DashboardStats,
  Faq,
  Notification,
  Order,
  OrderDetail,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentMethodConfig,
  Product,
  Profile,
  Promotion,
  Review,
  SiteSettings,
  SupportMessage,
} from '../types'
import { demoCategories, demoFaqs, demoPaymentMethods, demoProducts, demoPromotions, demoReviews, demoSettings } from '../data/demoSeed'
import { isBDPhone, isEmail, isTrxId, slugify } from '../lib/utils'

const KEY = 'nexora.demo.v1'

interface DemoUser {
  id: string
  email: string
  password: string
  full_name: string
  phone: string | null
  address: string | null
  city: string | null
  role: 'admin' | 'staff' | 'customer'
  created_at: string
}

interface DemoOrder extends Order {
  access_token: string
}

interface DemoState {
  users: DemoUser[]
  sessionUserId: string | null
  products: Product[]
  categories: Category[]
  orders: DemoOrder[]
  orderItems: OrderItem[]
  payments: Payment[]
  history: Record<string, { status: OrderStatus; note: string | null; created_at: string }[]>
  coupons: Coupon[]
  settings: SiteSettings
  paymentMethods: PaymentMethodConfig[]
  faqs: Faq[]
  promotions: Promotion[]
  reviews: Review[]
  support: SupportMessage[]
  notifications: Notification[]
}

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function seedState(): DemoState {
  const now = new Date().toISOString()
  const admin: DemoUser = {
    id: 'user-admin',
    email: 'admin@nexora.store',
    password: 'Nexora@2026',
    full_name: 'NEXORA Admin',
    phone: '01575864415',
    address: 'Dhanmondi',
    city: 'Dhaka',
    role: 'admin',
    created_at: now,
  }
  const customer: DemoUser = {
    id: 'user-demo',
    email: 'customer@nexora.store',
    password: 'Customer@2026',
    full_name: 'Demo Customer',
    phone: '01711000000',
    address: 'Gulshan 2',
    city: 'Dhaka',
    role: 'customer',
    created_at: now,
  }
  return {
    users: [admin, customer],
    sessionUserId: null,
    products: demoProducts,
    categories: demoCategories,
    orders: [],
    orderItems: [],
    payments: [],
    history: {},
    coupons: [
      {
        id: 'coupon-1',
        code: 'NEXORA10',
        description: '10% off your first order',
        type: 'percentage',
        value: 10,
        min_order: 500,
        max_discount: 300,
        usage_limit: 500,
        used_count: 0,
        starts_at: now,
        expires_at: null,
        is_active: true,
      },
      {
        id: 'coupon-2',
        code: 'AI200',
        description: '৳200 off AI subscriptions',
        type: 'fixed',
        value: 200,
        min_order: 900,
        max_discount: null,
        usage_limit: null,
        used_count: 0,
        starts_at: now,
        expires_at: null,
        is_active: true,
      },
    ],
    settings: demoSettings as SiteSettings,
    paymentMethods: demoPaymentMethods,
    faqs: demoFaqs,
    promotions: demoPromotions,
    reviews: demoReviews,
    support: [],
    notifications: [],
  }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const fresh = seedState()
      localStorage.setItem(KEY, JSON.stringify(fresh))
      return fresh
    }
    return JSON.parse(raw) as DemoState
  } catch {
    return seedState()
  }
}

let state: DemoState = load()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota — ignore */
  }
}

const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms))

const publicUser = (u: DemoUser): Profile => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  phone: u.phone,
  address: u.address,
  city: u.city,
  avatar_url: null,
  is_blocked: false,
  created_at: u.created_at,
})

const currentUser = () => state.users.find((u) => u.id === state.sessionUserId) ?? null

function requireAdmin(): DemoUser {
  const u = currentUser()
  if (!u || (u.role !== 'admin' && u.role !== 'staff')) {
    throw new Error('Administrator access required.')
  }
  return u
}

/* ------------------------------- auth ------------------------------- */
export const demoAuth = {
  async getUser(): Promise<Profile | null> {
    const u = currentUser()
    return u ? publicUser(u) : null
  },

  async getRole(): Promise<'admin' | 'staff' | 'customer' | null> {
    return currentUser()?.role ?? null
  },

  async signIn(email: string, password: string): Promise<Profile> {
    await wait(320)
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password. Please try again.')
    }
    state.sessionUserId = user.id
    save()
    return publicUser(user)
  },

  async signUp(input: {
    email: string
    password: string
    fullName: string
    phone?: string
  }): Promise<Profile> {
    await wait(380)
    if (!isEmail(input.email)) throw new Error('Please enter a valid email address.')
    if (input.password.length < 8) throw new Error('Password must be at least 8 characters.')
    if (state.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new Error('An account with this email already exists.')
    }
    const user: DemoUser = {
      id: uid('user'),
      email: input.email.trim(),
      password: input.password,
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      address: null,
      city: null,
      role: 'customer',
      created_at: new Date().toISOString(),
    }
    state.users.push(user)
    state.sessionUserId = user.id
    save()
    return publicUser(user)
  },

  async signOut(): Promise<void> {
    state.sessionUserId = null
    save()
  },

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const u = currentUser()
    if (!u) throw new Error('Not signed in.')
    Object.assign(u, {
      full_name: patch.full_name ?? u.full_name,
      phone: patch.phone ?? u.phone,
      address: patch.address ?? u.address,
      city: patch.city ?? u.city,
    })
    save()
    return publicUser(u)
  },

  async changePassword(next: string): Promise<void> {
    const u = currentUser()
    if (!u) throw new Error('Not signed in.')
    if (next.length < 8) throw new Error('Password must be at least 8 characters.')
    u.password = next
    save()
  },
}

/* ---------------------------- catalogue ---------------------------- */
export const demoCatalogue = {
  async categories(): Promise<Category[]> {
    await wait(80)
    return [...state.categories].sort((a, b) => a.sort_order - b.sort_order)
  },

  async products(query: {
    search?: string
    categorySlug?: string
    categoryId?: string
    sort?: string
    availability?: string
    featuredOnly?: boolean
    page?: number
    perPage?: number
  }): Promise<{ rows: Product[]; total: number; page: number; perPage: number }> {
    await wait(120)
    const page = query.page ?? 1
    const perPage = query.perPage ?? 12
    let rows = state.products.filter((p) => p.is_active)

    if (query.categorySlug) {
      const cat = state.categories.find((c) => c.slug === query.categorySlug)
      rows = rows.filter((p) => p.category_id === (cat?.id ?? query.categorySlug))
    }
    if (query.categoryId) rows = rows.filter((p) => p.category_id === query.categoryId)
    if (query.featuredOnly) rows = rows.filter((p) => p.is_featured)
    if (query.availability && query.availability !== 'all') {
      rows = rows.filter((p) => p.availability === query.availability)
    }
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase()
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q) ||
          (p.short_description ?? '').toLowerCase().includes(q),
      )
    }

    switch (query.sort) {
      case 'price_asc':
        rows.sort((a, b) => a.discounted_price - b.discounted_price)
        break
      case 'price_desc':
        rows.sort((a, b) => b.discounted_price - a.discounted_price)
        break
      case 'newest':
        rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        break
      case 'popular':
        rows.sort((a, b) => b.sales_count - a.sales_count)
        break
      case 'discount':
        rows.sort(
          (a, b) =>
            (b.original_price - b.discounted_price) / (b.original_price || 1) -
            (a.original_price - a.discounted_price) / (a.original_price || 1),
        )
        break
      default:
        rows.sort((a, b) => a.sort_order - b.sort_order)
    }

    const total = rows.length
    return { rows: rows.slice((page - 1) * perPage, page * perPage), total, page, perPage }
  },

  async productBySlug(slug: string): Promise<Product | null> {
    await wait(90)
    return state.products.find((p) => p.slug === slug) ?? null
  },

  async related(product: Product, limit = 4): Promise<Product[]> {
    return state.products
      .filter((p) => p.is_active && p.category_id === product.category_id && p.id !== product.id)
      .slice(0, limit)
  },

  async paymentMethods(): Promise<PaymentMethodConfig[]> {
    return state.paymentMethods.filter((m) => m.is_active).sort((a, b) => a.sort_order - b.sort_order)
  },

  async settings(): Promise<SiteSettings> {
    return state.settings
  },

  async faqs(): Promise<Faq[]> {
    return state.faqs.filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order)
  },

  async promotions(): Promise<Promotion[]> {
    return state.promotions.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order)
  },

  async reviews(): Promise<Review[]> {
    return state.reviews.filter((r) => r.is_approved)
  },
}

/* ------------------------------ orders ------------------------------ */
function buildOrderDetail(order: DemoOrder): OrderDetail {
  return {
    order: { ...order },
    items: state.orderItems.filter((i) => i.order_id === order.id),
    payment: state.payments.filter((p) => p.order_id === order.id).at(-1) ?? null,
    history: state.history[order.id] ?? [],
  }
}

function pushHistory(orderId: string, status: OrderStatus, note: string | null) {
  state.history[orderId] = [
    ...(state.history[orderId] ?? []),
    { status, note, created_at: new Date().toISOString() },
  ]
}

function notify(type: string, title: string, body: string, orderId: string) {
  state.notifications.unshift({
    id: uid('ntf'),
    type,
    title,
    body,
    link: '/admin/orders',
    order_id: orderId,
    is_read: false,
    created_at: new Date().toISOString(),
  })
}

export const demoOrders = {
  async place(input: {
    items: { product_id: string; quantity: number }[]
    customer_name: string
    customer_email: string
    customer_phone: string
    customer_note?: string
    payment_method: PaymentMethod
    coupon_code?: string
  }): Promise<{ orderId: string; orderNumber: string; accessToken: string; total: number; subtotal: number; discount: number }> {
    await wait(620)
    if (!input.items.length) throw new Error('Your cart is empty.')
    if (!input.customer_name.trim() || input.customer_name.trim().length < 2)
      throw new Error('Please provide your full name.')
    if (!isBDPhone(input.customer_phone))
      throw new Error('Please provide a valid Bangladeshi mobile number.')
    if (!isEmail(input.customer_email)) throw new Error('Please provide a valid email address.')

    // server-side re-pricing (mirrors place_order())
    let subtotal = 0
    const priced: { product: Product; qty: number }[] = []
    for (const line of input.items) {
      const product = state.products.find((p) => p.id === line.product_id && p.is_active)
      if (!product) throw new Error('A product in your cart is no longer available.')
      if (product.availability === 'out_of_stock')
        throw new Error(`${product.name} is currently out of stock.`)
      const qty = Math.max(1, Math.min(line.quantity || 1, 20))
      subtotal += product.discounted_price * qty
      priced.push({ product, qty })
    }

    let discount = 0
    if (input.coupon_code?.trim()) {
      const coupon = state.coupons.find(
        (c) => c.code.toLowerCase() === input.coupon_code!.trim().toLowerCase() && c.is_active,
      )
      if (!coupon) throw new Error('Coupon code not found.')
      if (subtotal < coupon.min_order)
        throw new Error(`Minimum order for this coupon is ৳${coupon.min_order}`)
      discount =
        coupon.type === 'percentage'
          ? Math.min((subtotal * coupon.value) / 100, coupon.max_discount ?? Infinity)
          : Math.min(coupon.value, subtotal)
      discount = Math.round(discount * 100) / 100
      coupon.used_count += 1
    }

    const total = Math.max(0, subtotal - discount)
    const now = new Date().toISOString()
    const orderId = uid('order')
    const seq = String(state.orders.length + 10001).slice(-5)
    const orderNumber = `NX-${now.slice(2, 4)}${now.slice(5, 7)}${now.slice(8, 10)}-${seq}`
    const accessToken = uid('tok')

    const order: DemoOrder = {
      id: orderId,
      order_number: orderNumber,
      access_token: accessToken,
      user_id: state.sessionUserId,
      customer_name: input.customer_name.trim(),
      customer_email: input.customer_email.trim(),
      customer_phone: input.customer_phone.trim(),
      customer_note: input.customer_note?.trim() || null,
      subtotal,
      discount,
      total,
      coupon_code: input.coupon_code?.trim().toUpperCase() || null,
      payment_method: input.payment_method,
      status: 'pending_payment',
      created_at: now,
      updated_at: now,
    }
    state.orders.unshift(order)

    for (const { product, qty } of priced) {
      state.orderItems.push({
        id: uid('oi'),
        order_id: orderId,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        duration: product.duration,
        unit_price: product.discounted_price,
        quantity: qty,
        line_total: product.discounted_price * qty,
        created_at: now,
      })
    }

    state.payments.push({
      id: uid('pay'),
      order_id: orderId,
      method: input.payment_method,
      amount: total,
      sender_number: null,
      transaction_id: null,
      proof_url: null,
      status: 'pending',
      verified_at: null,
      created_at: now,
    })

    pushHistory(orderId, 'pending_payment', 'Order created')
    notify('order', `New order ${orderNumber}`, `${order.customer_name} · ৳${total}`, orderId)
    save()

    return { orderId, orderNumber, accessToken, total, subtotal, discount }
  },

  async get(orderNumber: string, token?: string | null): Promise<OrderDetail> {
    await wait(180)
    const user = currentUser()
    const order = state.orders.find((o) => o.order_number === orderNumber)
    const allowed =
      order &&
      ((user && (user.id === order.user_id || user.role === 'admin' || user.role === 'staff')) ||
        (!order.user_id && token && token === order.access_token))
    if (!order || !allowed) throw new Error('Order not found.')
    return buildOrderDetail(order)
  },

  async mine(): Promise<Order[]> {
    await wait(220)
    const user = currentUser()
    if (!user) return []
    return state.orders
      .filter((o) => o.user_id === user.id)
      .map((o) => ({
        ...o,
        order_items: state.orderItems.filter((i) => i.order_id === o.id),
      }))
  },

  /** Demo mode has no storage bucket — keep the selected file local and
      record a placeholder URL so the admin UI still shows a proof link. */
  async uploadProof(orderNumber: string, file: File): Promise<string> {
    await wait(320)
    if (file.size > 5 * 1024 * 1024) throw new Error('File must be smaller than 5 MB.')
    return `demo-proof://${orderNumber}/${encodeURIComponent(file.name)}`
  },

  async submitPayment(input: {
    orderNumber: string
    token?: string | null
    method: PaymentMethod
    transactionId: string
    senderNumber?: string
    amount?: number
    proofUrl?: string
  }): Promise<void> {
    await wait(520)
    const user = currentUser()
    const order = state.orders.find((o) => o.order_number === input.orderNumber)
    if (!order) throw new Error('Order not found.')
    const allowed =
      (user && (user.id === order.user_id || user.role === 'admin' || user.role === 'staff')) ||
      (!order.user_id && input.token === order.access_token)
    if (!allowed) throw new Error('You are not allowed to update this order.')
    if (order.status !== 'pending_payment')
      throw new Error('Payment for this order has already been submitted.')
    if (!isTrxId(input.transactionId))
      throw new Error('Please enter a valid transaction ID (4–40 letters/numbers).')

    const payment = state.payments.find((p) => p.order_id === order.id)!
    payment.method = input.method
    payment.transaction_id = input.transactionId.trim().toUpperCase()
    payment.sender_number = input.senderNumber?.trim() || null
    payment.amount = input.amount ?? order.total
    payment.proof_url = input.proofUrl ?? payment.proof_url
    payment.status = 'submitted'

    order.status = 'payment_submitted'
    order.payment_method = input.method
    order.updated_at = new Date().toISOString()
    pushHistory(order.id, 'payment_submitted', 'Payment submitted by customer')
    notify(
      'payment',
      `Payment submitted · ${order.order_number}`,
      `${input.method} · TrxID ${payment.transaction_id}`,
      order.id,
    )
    save()
  },

  async claim(orderNumber: string, email: string): Promise<{ ok: boolean; message: string }> {
    const user = currentUser()
    if (!user) throw new Error('Please sign in first.')
    const order = state.orders.find(
      (o) =>
        o.order_number === orderNumber &&
        o.customer_email.toLowerCase() === email.trim().toLowerCase() &&
        !o.user_id,
    )
    if (!order) return { ok: false, message: 'No matching guest order found.' }
    order.user_id = user.id
    save()
    return { ok: true, message: 'Order added to your account.' }
  },
}

/* ------------------------------ coupons ------------------------------ */
export const demoCoupons = {
  async validate(code: string, subtotal: number) {
    await wait(240)
    const coupon = state.coupons.find(
      (c) => c.code.toLowerCase() === code.trim().toLowerCase() && c.is_active,
    )
    if (!coupon) return { valid: false, message: 'Coupon code not found.' } as const
    if (subtotal < coupon.min_order)
      return { valid: false, message: `Minimum order for this coupon is ৳${coupon.min_order}` } as const
    let discount =
      coupon.type === 'percentage'
        ? Math.min((subtotal * coupon.value) / 100, coupon.max_discount ?? Infinity)
        : Math.min(coupon.value, subtotal)
    discount = Math.round(discount * 100) / 100
    return { valid: true, discount, message: 'Coupon applied.', description: coupon.description } as const
  },
}

/* ------------------------------ support ------------------------------ */
export const demoSupport = {
  async send(input: {
    name: string
    email: string
    phone?: string
    subject: string
    message: string
    order_number?: string
  }) {
    await wait(420)
    if (!input.name.trim() || !isEmail(input.email) || input.message.trim().length < 5)
      throw new Error('Please fill in your name, a valid email and a message.')
    state.support.unshift({
      id: uid('sup'),
      user_id: state.sessionUserId,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      subject: input.subject.trim() || 'General enquiry',
      message: input.message.trim(),
      order_number: input.order_number?.trim() || null,
      status: 'open',
      admin_reply: null,
      replied_at: null,
      created_at: new Date().toISOString(),
    })
    save()
  },

  async mine(): Promise<SupportMessage[]> {
    const user = currentUser()
    if (!user) return []
    return state.support.filter((s) => s.user_id === user.id)
  },
}

/* ------------------------------- admin ------------------------------- */
export const demoAdmin = {
  async stats(): Promise<DashboardStats> {
    await wait(200)
    requireAdmin()
    const paid = state.orders.filter((o) =>
      ['completed', 'processing', 'payment_verified'].includes(o.status),
    )
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      const key = d.toISOString().slice(0, 10)
      const total = paid
        .filter((o) => o.created_at.slice(0, 10) === key)
        .reduce((s, o) => s + o.total, 0)
      return { day: key, total }
    })
    const today = new Date().toISOString().slice(0, 10)
    return {
      total_sales: paid.reduce((s, o) => s + o.total, 0),
      total_orders: state.orders.length,
      pending_orders: state.orders.filter((o) =>
        ['pending_payment', 'payment_submitted'].includes(o.status),
      ).length,
      completed_orders: state.orders.filter((o) => o.status === 'completed').length,
      total_customers: state.users.length,
      total_products: state.products.filter((p) => p.is_active).length,
      unread_notifications: state.notifications.filter((n) => !n.is_read).length,
      open_support: state.support.filter((s) => s.status === 'open').length,
      revenue_today: paid.filter((o) => o.created_at.slice(0, 10) === today).reduce((s, o) => s + o.total, 0),
      orders_today: state.orders.filter((o) => o.created_at.slice(0, 10) === today).length,
      sales_series: days,
    }
  },

  async orders(filters: { search?: string; status?: string } = {}) {
    await wait(200)
    requireAdmin()
    let rows = [...state.orders]
    if (filters.status && filters.status !== 'all') rows = rows.filter((o) => o.status === filters.status)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      rows = rows.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_email.toLowerCase().includes(q) ||
          o.customer_phone.includes(q),
      )
    }
    return rows.map((o) => ({
      ...o,
      order_items: state.orderItems.filter((i) => i.order_id === o.id),
      payments: state.payments.filter((p) => p.order_id === o.id),
    }))
  },

  async orderDetail(orderId: string) {
    requireAdmin()
    const order = state.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('Order not found.')
    return buildOrderDetail(order)
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string) {
    await wait(260)
    const admin = requireAdmin()
    const order = state.orders.find((o) => o.id === orderId)
    if (!order) throw new Error('Order not found.')
    order.status = status
    order.updated_at = new Date().toISOString()
    pushHistory(orderId, status, note?.trim() || `Updated by ${admin.full_name}`)
    save()
  },

  async verifyPayment(paymentId: string, decision: 'verified' | 'rejected', note?: string) {
    await wait(300)
    requireAdmin()
    const payment = state.payments.find((p) => p.id === paymentId)
    if (!payment) throw new Error('Payment not found.')
    payment.status = decision
    payment.admin_note = note ?? null
    payment.verified_at = decision === 'verified' ? new Date().toISOString() : null
    const order = state.orders.find((o) => o.id === payment.order_id)
    if (order) {
      order.status = decision === 'verified' ? 'payment_verified' : 'pending_payment'
      order.updated_at = new Date().toISOString()
      pushHistory(
        order.id,
        order.status,
        decision === 'verified'
          ? 'Payment verified by admin'
          : `Payment rejected: ${note || 'invalid transaction'}`,
      )
    }
    save()
  },

  async setNote(orderId: string, note: string) {
    requireAdmin()
    const order = state.orders.find((o) => o.id === orderId)
    if (order) order.admin_note = note
    save()
  },

  async customers() {
    await wait(180)
    requireAdmin()
    return state.users.map((u) => ({
      ...publicUser(u),
      role: u.role,
      order_count: state.orders.filter((o) => o.user_id === u.id).length,
      total_spent: state.orders
        .filter((o) => o.user_id === u.id && o.status === 'completed')
        .reduce((s, o) => s + o.total, 0),
    }))
  },

  async saveProduct(input: Partial<Product> & { name: string }) {
    await wait(340)
    requireAdmin()
    if (input.id) {
      const product = state.products.find((p) => p.id === input.id)
      if (!product) throw new Error('Product not found.')
      Object.assign(product, input, {
        slug: input.slug?.trim() || product.slug,
        updated_at: new Date().toISOString(),
      })
    } else {
      if (state.products.some((p) => p.slug === slugify(input.name) || p.slug === input.slug)) {
        throw new Error('A product with this name/slug already exists.')
      }
      state.products.unshift({
        id: uid('prod'),
        category_id: input.category_id ?? state.categories[0].id,
        name: input.name,
        slug: input.slug?.trim() || slugify(input.name),
        brand: input.brand ?? null,
        short_description: input.short_description ?? null,
        description: input.description ?? null,
        image_url: input.image_url ?? null,
        gallery: input.gallery ?? [],
        duration: input.duration ?? '1 Month',
        original_price: input.original_price ?? 0,
        discounted_price: input.discounted_price ?? 0,
        delivery_info: input.delivery_info ?? 'Instant delivery after payment verification.',
        delivery_time: input.delivery_time ?? 'Within 30 minutes',
        availability: input.availability ?? 'in_stock',
        is_featured: input.is_featured ?? false,
        is_active: input.is_active ?? true,
        badge: input.badge ?? null,
        rating: input.rating ?? 4.8,
        rating_count: input.rating_count ?? 0,
        sales_count: input.sales_count ?? 0,
        sort_order: input.sort_order ?? state.products.length + 1,
        admin_note: input.admin_note ?? null,
        created_at: new Date().toISOString(),
      })
    }
    save()
  },

  async deleteProduct(id: string) {
    requireAdmin()
    state.products = state.products.filter((p) => p.id !== id)
    save()
  },

  async allProducts() {
    requireAdmin()
    return [...state.products].sort((a, b) => a.sort_order - b.sort_order)
  },

  async saveCategory(input: Partial<Category> & { name: string }) {
    requireAdmin()
    if (input.id) {
      const c = state.categories.find((x) => x.id === input.id)
      if (c) Object.assign(c, input)
    } else {
      state.categories.push({
        id: uid('cat'),
        name: input.name,
        slug: input.slug?.trim() || slugify(input.name),
        description: input.description ?? null,
        icon: input.icon ?? 'Sparkles',
        image_url: null,
        accent: input.accent ?? 'blue',
        sort_order: input.sort_order ?? state.categories.length + 1,
        is_active: input.is_active ?? true,
      })
    }
    save()
  },

  async deleteCategory(id: string) {
    requireAdmin()
    state.categories = state.categories.filter((c) => c.id !== id)
    save()
  },

  async allCoupons() {
    requireAdmin()
    return [...state.coupons]
  },

  async saveCoupon(input: Partial<Coupon> & { code: string }) {
    requireAdmin()
    if (input.id) {
      const c = state.coupons.find((x) => x.id === input.id)
      if (c) Object.assign(c, input)
    } else {
      state.coupons.push({
        id: uid('coupon'),
        code: input.code.trim().toUpperCase(),
        description: input.description ?? null,
        type: input.type ?? 'percentage',
        value: input.value ?? 10,
        min_order: input.min_order ?? 0,
        max_discount: input.max_discount ?? null,
        usage_limit: input.usage_limit ?? null,
        used_count: 0,
        starts_at: new Date().toISOString(),
        expires_at: input.expires_at ?? null,
        is_active: input.is_active ?? true,
      })
    }
    save()
  },

  async deleteCoupon(id: string) {
    requireAdmin()
    state.coupons = state.coupons.filter((c) => c.id !== id)
    save()
  },

  async allFaqs() {
    requireAdmin()
    return [...state.faqs]
  },

  async saveFaq(input: Partial<Faq> & { question: string; answer: string }) {
    requireAdmin()
    if (input.id) {
      const f = state.faqs.find((x) => x.id === input.id)
      if (f) Object.assign(f, input)
    } else {
      state.faqs.push({
        id: uid('faq'),
        question: input.question,
        answer: input.answer,
        category: input.category ?? 'General',
        sort_order: input.sort_order ?? state.faqs.length + 1,
        is_active: input.is_active ?? true,
      })
    }
    save()
  },

  async deleteFaq(id: string) {
    requireAdmin()
    state.faqs = state.faqs.filter((f) => f.id !== id)
    save()
  },

  async paymentMethods() {
    requireAdmin()
    return [...state.paymentMethods]
  },

  async savePaymentMethod(input: PaymentMethodConfig) {
    requireAdmin()
    const m = state.paymentMethods.find((x) => x.id === input.id)
    if (m) Object.assign(m, input)
    save()
  },

  async settings() {
    requireAdmin()
    return state.settings
  },

  async saveSettings(patch: Partial<SiteSettings>) {
    await wait(280)
    requireAdmin()
    state.settings = { ...state.settings, ...patch } as SiteSettings
    save()
  },

  async notifications(): Promise<Notification[]> {
    requireAdmin()
    return [...state.notifications]
  },

  async markNotificationsRead() {
    requireAdmin()
    state.notifications = state.notifications.map((n) => ({ ...n, is_read: true }))
    save()
  },

  async supportMessages() {
    requireAdmin()
    return [...state.support]
  },

  async replySupport(id: string, reply: string) {
    requireAdmin()
    const msg = state.support.find((s) => s.id === id)
    if (msg) {
      msg.admin_reply = reply
      msg.status = 'replied'
      msg.replied_at = new Date().toISOString()
    }
    save()
  },

  async promotions() {
    requireAdmin()
    return [...state.promotions]
  },

  async savePromotion(input: Partial<Promotion> & { title: string }) {
    requireAdmin()
    if (input.id) {
      const p = state.promotions.find((x) => x.id === input.id)
      if (p) Object.assign(p, input)
    } else {
      state.promotions.push({
        id: uid('promo'),
        title: input.title,
        subtitle: input.subtitle ?? null,
        description: input.description ?? null,
        image_url: input.image_url ?? null,
        badge: input.badge ?? null,
        cta_label: input.cta_label ?? 'Shop Now',
        cta_link: input.cta_link ?? '/products',
        discount_text: input.discount_text ?? null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? state.promotions.length + 1,
      })
    }
    save()
  },

  async deletePromotion(id: string) {
    requireAdmin()
    state.promotions = state.promotions.filter((p) => p.id !== id)
    save()
  },

  async reviews() {
    requireAdmin()
    return [...state.reviews]
  },

  async setReviewApproval(id: string, approved: boolean) {
    requireAdmin()
    const r = state.reviews.find((x) => x.id === id)
    if (r) r.is_approved = approved
    save()
  },

  async resetDemoData() {
    state = seedState()
    save()
  },
}

export const demoBackend = {
  auth: demoAuth,
  catalogue: demoCatalogue,
  orders: demoOrders,
  coupons: demoCoupons,
  support: demoSupport,
  admin: demoAdmin,
}
