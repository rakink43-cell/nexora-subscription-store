/* ---------------------------------------------------------------------------
   Supabase data layer — the production implementation.
   Every write to orders/payments goes through SECURITY DEFINER RPCs; the
   client never inserts prices or statuses directly.
--------------------------------------------------------------------------- */
import { supabase } from '../lib/supabase'
import type {
  Category,
  Coupon,
  DashboardStats,
  Faq,
  Notification,
  Order,
  OrderDetail,
  OrderStatus,
  PaymentMethod,
  PaymentMethodConfig,
  Product,
  Profile,
  Promotion,
  Review,
  SiteSettings,
  SupportMessage,
} from '../types'

const sb = () => {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

/** Normalise a Supabase/PostgREST error into a friendly message. */
function fail(error: unknown, fallback = 'Something went wrong. Please try again.'): never {
  const message =
    (error as { message?: string })?.message ??
    (typeof error === 'string' ? error : fallback) ??
    fallback
  const clean = message
    .replace(/^ERROR:\s*/i, '')
    .replace(/^.*duplicate key value violates unique constraint.*$/i, 'That record already exists.')
  throw new Error(clean || fallback)
}

async function unwrap<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) fail(error)
  return data
}

/* --------------------------------- auth --------------------------------- */
export const auth = {
  async getUser(): Promise<Profile | null> {
    const { data } = await sb().auth.getSession()
    if (!data.session?.user) return null
    const { data: profile, error } = await sb()
      .from('profiles')
      .select('*')
      .eq('id', data.session.user.id)
      .maybeSingle()
    if (error) return null
    if (profile) return profile as Profile
    return {
      id: data.session.user.id,
      full_name: (data.session.user.user_metadata?.full_name as string) ?? null,
      email: data.session.user.email ?? null,
      phone: (data.session.user.user_metadata?.phone as string) ?? null,
      address: null,
      city: null,
      avatar_url: null,
      created_at: data.session.user.created_at,
    }
  },

  async getRole(): Promise<'admin' | 'staff' | 'customer' | null> {
    const { data: session } = await sb().auth.getSession()
    if (!session.session?.user) return null
    const { data, error } = await sb()
      .from('user_roles')
      .select('role')
      .eq('user_id', session.session.user.id)
    if (error) return 'customer'
    const roles = (data ?? []).map((r) => r.role as string)
    if (roles.includes('admin')) return 'admin'
    if (roles.includes('staff')) return 'staff'
    return 'customer'
  },

  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await sb().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) fail(error, 'Invalid email or password.')
    if (!data.user) throw new Error('Invalid email or password.')
    return (await auth.getUser())!
  },

  async signUp(input: { email: string; password: string; fullName: string; phone?: string }) {
    const { data, error } = await sb().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: { full_name: input.fullName.trim(), phone: input.phone?.trim() ?? '' },
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    })
    if (error) fail(error, 'Could not create your account.')
    const needsConfirmation = !data.session
    return { needsConfirmation }
  },

  async signOut(): Promise<void> {
    await sb().auth.signOut()
  },

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const { data: session } = await sb().auth.getSession()
    if (!session.session?.user) throw new Error('Not signed in.')
    const { data, error } = await sb()
      .from('profiles')
      .update({
        full_name: patch.full_name,
        phone: patch.phone,
        address: patch.address,
        city: patch.city,
      })
      .eq('id', session.session.user.id)
      .select()
      .single()
    if (error) fail(error)
    return data as Profile
  },

  async changePassword(password: string): Promise<void> {
    const { error } = await sb().auth.updateUser({ password })
    if (error) fail(error, 'Could not update your password.')
  },

  async resetPassword(email: string): Promise<void> {
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login?reset=1`,
    })
    if (error) fail(error)
  },
}

/* ------------------------------- catalogue ------------------------------- */
const PRODUCT_COLUMNS =
  'id,category_id,name,slug,brand,short_description,description,image_url,gallery,duration,original_price,discounted_price,delivery_info,delivery_time,availability,is_featured,is_active,badge,rating,rating_count,sales_count,sort_order,created_at,updated_at'

export const catalogue = {
  async categories(): Promise<Category[]> {
    return unwrap(
      sb().from('categories').select('*').eq('is_active', true).order('sort_order'),
    ) as Promise<Category[]>
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
  }) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 12
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let builder = sb()
      .from('public_products')
      .select(PRODUCT_COLUMNS, { count: 'exact' })
      .eq('is_active', true)

    if (query.categoryId) builder = builder.eq('category_id', query.categoryId)
    if (query.categorySlug) {
      const { data: cat } = await sb()
        .from('categories')
        .select('id')
        .eq('slug', query.categorySlug)
        .maybeSingle()
      if (!cat) return { rows: [], total: 0, page, perPage }
      builder = builder.eq('category_id', cat.id)
    }
    if (query.featuredOnly) builder = builder.eq('is_featured', true)
    if (query.availability && query.availability !== 'all') {
      builder = builder.eq('availability', query.availability)
    }
    if (query.search?.trim()) {
      const q = query.search.trim().replace(/[%,()]/g, ' ')
      builder = builder.or(
        `name.ilike.%${q}%,brand.ilike.%${q}%,short_description.ilike.%${q}%`,
      )
    }

    switch (query.sort) {
      case 'price_asc':
        builder = builder.order('discounted_price', { ascending: true })
        break
      case 'price_desc':
        builder = builder.order('discounted_price', { ascending: false })
        break
      case 'newest':
        builder = builder.order('created_at', { ascending: false })
        break
      case 'popular':
        builder = builder.order('sales_count', { ascending: false })
        break
      default:
        builder = builder
          .order('is_featured', { ascending: false })
          .order('sort_order', { ascending: true })
    }

    const { data, error, count } = await builder.range(from, to)
    if (error) fail(error)
    return {
      rows: (data ?? []) as unknown as Product[],
      total: count ?? 0,
      page,
      perPage,
    }
  },

  async productBySlug(slug: string): Promise<Product | null> {
    const { data, error } = await sb()
      .from('public_products')
      .select(PRODUCT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle()
    if (error) fail(error)
    return (data as unknown as Product) ?? null
  },

  async related(product: Product, limit = 4): Promise<Product[]> {
    let builder = sb()
      .from('public_products')
      .select(PRODUCT_COLUMNS)
      .eq('is_active', true)
      .neq('id', product.id)
      .limit(limit)
    if (product.category_id) builder = builder.eq('category_id', product.category_id)
    const { data, error } = await builder
    if (error) return []
    return (data ?? []) as unknown as Product[]
  },

  async paymentMethods(): Promise<PaymentMethodConfig[]> {
    return unwrap(
      sb().from('payment_methods').select('*').eq('is_active', true).order('sort_order'),
    ) as Promise<PaymentMethodConfig[]>
  },

  async settings(): Promise<SiteSettings> {
    const { data, error } = await sb().from('website_settings').select('key,value').eq('is_public', true)
    if (error) fail(error)
    const map: Record<string, unknown> = {}
    for (const row of data ?? []) map[row.key as string] = row.value
    return map as unknown as SiteSettings
  },

  async faqs(): Promise<Faq[]> {
    return unwrap(
      sb().from('faqs').select('*').eq('is_active', true).order('sort_order'),
    ) as Promise<Faq[]>
  },

  async promotions(): Promise<Promotion[]> {
    return unwrap(
      sb().from('promotions').select('*').eq('is_active', true).order('sort_order'),
    ) as Promise<Promotion[]>
  },

  async reviews(): Promise<Review[]> {
    return unwrap(
      sb()
        .from('reviews')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(24),
    ) as Promise<Review[]>
  },
}

/* --------------------------------- orders --------------------------------- */
export const orders = {
  async place(input: {
    items: { product_id: string; quantity: number }[]
    customer_name: string
    customer_email: string
    customer_phone: string
    customer_note?: string
    payment_method: PaymentMethod
    coupon_code?: string
  }) {
    const { data, error } = await sb().rpc('place_order', {
      _items: input.items,
      _customer_name: input.customer_name,
      _customer_email: input.customer_email,
      _customer_phone: input.customer_phone,
      _customer_note: input.customer_note ?? null,
      _payment_method: input.payment_method,
      _coupon_code: input.coupon_code?.trim() || null,
    })
    if (error) fail(error, 'Could not place your order.')
    const r = data as {
      order_id: string
      order_number: string
      access_token: string
      total: number
      subtotal: number
      discount: number
    }
    return {
      orderId: r.order_id,
      orderNumber: r.order_number,
      accessToken: r.access_token,
      total: Number(r.total),
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
    }
  },

  async get(orderNumber: string, token?: string | null): Promise<OrderDetail> {
    const { data, error } = await sb().rpc('get_order', {
      _order_number: orderNumber.trim().toUpperCase(),
      _access_token: token || '00000000-0000-0000-0000-000000000000',
    })
    if (error) fail(error, 'Order not found.')
    return data as unknown as OrderDetail
  },

  async mine(): Promise<Order[]> {
    const { data: session } = await sb().auth.getSession()
    if (!session.session?.user) return []
    const { data, error } = await sb()
      .from('orders')
      .select('*, order_items(*), payments(*)')
      .order('created_at', { ascending: false })
    if (error) fail(error)
    return (data ?? []) as unknown as Order[]
  },

  async submitPayment(input: {
    orderNumber: string
    token?: string | null
    method: PaymentMethod
    transactionId: string
    senderNumber?: string
    amount?: number
    proofUrl?: string
  }) {
    const { data, error } = await sb().rpc('submit_payment', {
      _order_number: input.orderNumber.trim().toUpperCase(),
      _access_token: input.token || '00000000-0000-0000-0000-000000000000',
      _method: input.method,
      _transaction_id: input.transactionId,
      _sender_number: input.senderNumber ?? null,
      _amount: input.amount ?? null,
      _proof_url: input.proofUrl ?? null,
    })
    if (error) fail(error, 'Could not submit your payment.')
    return data as { status: string; message: string }
  },

  async claim(orderNumber: string, email: string) {
    const { data, error } = await sb().rpc('claim_guest_order', {
      _order_number: orderNumber.trim().toUpperCase(),
      _email: email.trim(),
    })
    if (error) fail(error)
    const r = data as { ok: boolean; message?: string }
    return { ok: r.ok, message: r.message ?? 'Order added to your account.' }
  },

  /** Upload a payment screenshot into the private `payment-proofs` bucket. */
  async uploadProof(orderNumber: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
    if (!allowed.includes(ext)) throw new Error('Please upload a JPG, PNG, WEBP or PDF file.')
    if (file.size > 5 * 1024 * 1024) throw new Error('File must be smaller than 5 MB.')
    const path = `${orderNumber}/${Date.now()}.${ext}`
    const { error } = await sb()
      .storage.from('payment-proofs')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) fail(error, 'Could not upload the screenshot.')
    const { data } = sb().storage.from('payment-proofs').getPublicUrl(path)
    return data.publicUrl
  },
}

/* -------------------------------- coupons -------------------------------- */
export const coupons = {
  async validate(code: string, subtotal: number) {
    const { data, error } = await sb().rpc('validate_coupon', {
      _code: code.trim(),
      _subtotal: subtotal,
    })
    if (error) fail(error)
    return data as {
      valid: boolean
      discount?: number
      message: string
      description?: string
      code?: string
    }
  },
}

/* -------------------------------- support -------------------------------- */
export const support = {
  async send(input: {
    name: string
    email: string
    phone?: string
    subject: string
    message: string
    order_number?: string
  }) {
    const { data: session } = await sb().auth.getSession()
    const { error } = await sb().from('support_messages').insert({
      user_id: session.session?.user.id ?? null,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      subject: input.subject.trim(),
      message: input.message.trim(),
      order_number: input.order_number?.trim() || null,
    })
    if (error) fail(error, 'Could not send your message.')
  },

  async mine(): Promise<SupportMessage[]> {
    return unwrap(
      sb().from('support_messages').select('*').order('created_at', { ascending: false }),
    ) as Promise<SupportMessage[]>
  },
}

/* --------------------------------- admin --------------------------------- */
export const admin = {
  async stats(): Promise<DashboardStats> {
    const { data, error } = await sb().rpc('admin_dashboard_stats')
    if (error) fail(error, 'Admin access required.')
    return data as DashboardStats
  },

  async orders(filters: { search?: string; status?: string } = {}) {
    let builder = sb().from('orders').select('*, order_items(*), payments(*)').order('created_at', { ascending: false })
    if (filters.status && filters.status !== 'all') builder = builder.eq('status', filters.status)
    if (filters.search?.trim()) {
      const q = filters.search.trim().replace(/[%,()]/g, ' ')
      builder = builder.or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,customer_phone.ilike.%${q}%`,
      )
    }
    const { data, error } = await builder.limit(300)
    if (error) fail(error)
    return (data ?? []) as unknown as Order[]
  },

  async orderDetail(orderId: string): Promise<OrderDetail> {
    const { data, error } = await sb()
      .from('orders')
      .select('*, order_items(*), payments(*)')
      .eq('id', orderId)
      .maybeSingle()
    if (error) fail(error)
    if (!data) throw new Error('Order not found.')
    const { data: history } = await sb()
      .from('order_status_history')
      .select('status, note, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    const order = data as unknown as Order
    return {
      order,
      items: order.order_items ?? [],
      payment: (order.payments ?? [])[0] ?? null,
      history: (history ?? []) as OrderDetail['history'],
    }
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string) {
    const { error } = await sb().rpc('admin_update_order_status', {
      _order_id: orderId,
      _status: status,
      _note: note?.trim() || null,
    })
    if (error) fail(error)
  },

  async verifyPayment(paymentId: string, decision: 'verified' | 'rejected', note?: string) {
    const { error } = await sb().rpc('admin_verify_payment', {
      _payment_id: paymentId,
      _decision: decision,
      _note: note?.trim() || null,
    })
    if (error) fail(error)
  },

  async setNote(orderId: string, note: string) {
    const { error } = await sb().from('orders').update({ admin_note: note }).eq('id', orderId)
    if (error) fail(error)
  },

  async customers() {
    const { data, error } = await sb()
      .from('profiles')
      .select('*, orders(id,total,status)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) fail(error)
    return (data ?? []).map((p) => {
      const orders = (p.orders ?? []) as { total: number; status: string }[]
      return {
        ...(p as unknown as Profile),
        order_count: orders.length,
        total_spent: orders
          .filter((o) => o.status === 'completed')
          .reduce((s, o) => s + Number(o.total), 0),
      }
    })
  },

  async setBlocked(userId: string, blocked: boolean) {
    const { error } = await sb().from('profiles').update({ is_blocked: blocked }).eq('id', userId)
    if (error) fail(error)
  },

  /* ---- products ---- */
  async allProducts(): Promise<Product[]> {
    return unwrap(
      sb().from('products').select('*').order('sort_order', { ascending: true }),
    ) as Promise<Product[]>
  },

  async saveProduct(input: Partial<Product> & { name: string; slug: string }) {
    const payload = {
      category_id: input.category_id,
      name: input.name,
      slug: input.slug,
      brand: input.brand,
      short_description: input.short_description,
      description: input.description,
      image_url: input.image_url,
      duration: input.duration,
      original_price: input.original_price,
      discounted_price: input.discounted_price,
      delivery_info: input.delivery_info,
      delivery_time: input.delivery_time,
      availability: input.availability,
      is_featured: input.is_featured,
      is_active: input.is_active,
      badge: input.badge,
      admin_note: input.admin_note,
      sort_order: input.sort_order,
    }
    if (input.id) {
      const { error } = await sb().from('products').update(payload).eq('id', input.id)
      if (error) fail(error)
      return
    }
    const { error } = await sb().from('products').insert(payload)
    if (error) fail(error)
  },

  async deleteProduct(id: string) {
    const { error } = await sb().from('products').delete().eq('id', id)
    if (error) fail(error, 'Could not delete this product.')
  },

  async uploadProductImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext))
      throw new Error('Please upload a JPG, PNG or WEBP image.')
    if (file.size > 4 * 1024 * 1024) throw new Error('Image must be smaller than 4 MB.')
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await sb()
      .storage.from('product-images')
      .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
    if (error) fail(error, 'Could not upload the image.')
    const { data } = sb().storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  },

  /* ---- categories ---- */
  async saveCategory(input: Partial<Category> & { name: string; slug: string }) {
    const payload = {
      name: input.name,
      slug: input.slug,
      description: input.description,
      icon: input.icon,
      accent: input.accent,
      sort_order: input.sort_order,
      is_active: input.is_active,
    }
    if (input.id) {
      const { error } = await sb().from('categories').update(payload).eq('id', input.id)
      if (error) fail(error)
      return
    }
    const { error } = await sb().from('categories').insert(payload)
    if (error) fail(error)
  },

  async deleteCategory(id: string) {
    const { error } = await sb().from('categories').delete().eq('id', id)
    if (error) fail(error, 'Could not delete this category.')
  },

  /* ---- coupons ---- */
  async allCoupons(): Promise<Coupon[]> {
    return unwrap(sb().from('coupons').select('*').order('created_at', { ascending: false })) as Promise<Coupon[]>
  },

  async saveCoupon(input: Partial<Coupon> & { code: string }) {
    const payload = {
      code: input.code.trim().toUpperCase(),
      description: input.description,
      type: input.type,
      value: input.value,
      min_order: input.min_order,
      max_discount: input.max_discount,
      usage_limit: input.usage_limit,
      expires_at: input.expires_at,
      is_active: input.is_active,
    }
    if (input.id) {
      const { error } = await sb().from('coupons').update(payload).eq('id', input.id)
      if (error) fail(error)
      return
    }
    const { error } = await sb().from('coupons').insert(payload)
    if (error) fail(error)
  },

  async deleteCoupon(id: string) {
    const { error } = await sb().from('coupons').delete().eq('id', id)
    if (error) fail(error)
  },

  /* ---- faqs ---- */
  async allFaqs(): Promise<Faq[]> {
    return unwrap(sb().from('faqs').select('*').order('sort_order')) as Promise<Faq[]>
  },

  async saveFaq(input: Partial<Faq> & { question: string; answer: string }) {
    const payload = {
      question: input.question,
      answer: input.answer,
      category: input.category,
      sort_order: input.sort_order,
      is_active: input.is_active,
    }
    if (input.id) {
      const { error } = await sb().from('faqs').update(payload).eq('id', input.id)
      if (error) fail(error)
      return
    }
    const { error } = await sb().from('faqs').insert(payload)
    if (error) fail(error)
  },

  async deleteFaq(id: string) {
    const { error } = await sb().from('faqs').delete().eq('id', id)
    if (error) fail(error)
  },

  /* ---- promotions ---- */
  async promotions(): Promise<Promotion[]> {
    return unwrap(sb().from('promotions').select('*').order('sort_order')) as Promise<Promotion[]>
  },

  async savePromotion(input: Partial<Promotion> & { title: string }) {
    const payload = {
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      badge: input.badge,
      cta_label: input.cta_label,
      cta_link: input.cta_link,
      discount_text: input.discount_text,
      is_active: input.is_active,
      sort_order: input.sort_order,
    }
    if (input.id) {
      const { error } = await sb().from('promotions').update(payload).eq('id', input.id)
      if (error) fail(error)
      return
    }
    const { error } = await sb().from('promotions').insert(payload)
    if (error) fail(error)
  },

  async deletePromotion(id: string) {
    const { error } = await sb().from('promotions').delete().eq('id', id)
    if (error) fail(error)
  },

  /* ---- reviews ---- */
  async reviews(): Promise<Review[]> {
    return unwrap(
      sb().from('reviews').select('*').order('created_at', { ascending: false }).limit(200),
    ) as Promise<Review[]>
  },

  async setReviewApproval(id: string, approved: boolean) {
    const { error } = await sb().from('reviews').update({ is_approved: approved }).eq('id', id)
    if (error) fail(error)
  },

  /* ---- payment methods & settings ---- */
  async paymentMethods(): Promise<PaymentMethodConfig[]> {
    return unwrap(sb().from('payment_methods').select('*').order('sort_order')) as Promise<PaymentMethodConfig[]>
  },

  async savePaymentMethod(input: PaymentMethodConfig) {
    const { error } = await sb()
      .from('payment_methods')
      .update({
        display_name: input.display_name,
        account_name: input.account_name,
        account_number: input.account_number,
        account_type: input.account_type,
        bank_name: input.bank_name,
        branch: input.branch,
        routing_number: input.routing_number,
        instructions: input.instructions,
        is_active: input.is_active,
      })
      .eq('id', input.id)
    if (error) fail(error)
  },

  async settings(): Promise<SiteSettings> {
    const { data, error } = await sb().from('website_settings').select('key,value')
    if (error) fail(error)
    const map: Record<string, unknown> = {}
    for (const row of data ?? []) map[row.key as string] = row.value
    return map as unknown as SiteSettings
  },

  async saveSettings(patch: Partial<SiteSettings>) {
    const rows = Object.entries(patch).map(([key, value]) => ({
      key,
      value: value as object,
      label: key,
    }))
    const { error } = await sb().from('website_settings').upsert(rows, { onConflict: 'key' })
    if (error) fail(error)
  },

  /* ---- notifications & support ---- */
  async notifications(): Promise<Notification[]> {
    return unwrap(
      sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
    ) as Promise<Notification[]>
  },

  async markNotificationsRead() {
    const { error } = await sb().from('notifications').update({ is_read: true }).eq('is_read', false)
    if (error) fail(error)
  },

  async supportMessages(): Promise<SupportMessage[]> {
    return unwrap(
      sb().from('support_messages').select('*').order('created_at', { ascending: false }).limit(200),
    ) as Promise<SupportMessage[]>
  },

  async replySupport(id: string, reply: string) {
    const { error } = await sb()
      .from('support_messages')
      .update({
        admin_reply: reply,
        status: 'replied',
        replied_at: new Date().toISOString(),
        replied_by: (await sb().auth.getSession()).data.session?.user.id ?? null,
      })
      .eq('id', id)
    if (error) fail(error)
  },
}

export const supabaseBackend = { auth, catalogue, orders, coupons, support, admin }
