'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '../../../lib/api'

export default function EditCompanyPage() {
  const router = useRouter()
  const params = useParams()
  const companyId = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    vatNumber: '',
    commercialRegistration: '',
    address: '',
    streetName: '',
    buildingNumber: '',
    plotIdentification: '',
    citySubdivisionName: '',
    city: '',
    postalCode: '',
    country: 'Saudi Arabia',
    phone: '',
    email: '',
    website: '',
    logo: '',
    isActive: true,
  })

  useEffect(() => {
    if (!companyId) return
    const load = async () => {
      try {
        const res = await api.get(`/companies/${companyId}`)
        const c = res.data
        setFormData({
          name: c.name || '',
          nameAr: c.nameAr || '',
          vatNumber: c.vatNumber || '',
          commercialRegistration: c.commercialRegistration || '',
          address: c.address || '',
          streetName: c.streetName || '',
          buildingNumber: c.buildingNumber || '',
          plotIdentification: c.plotIdentification || '',
          citySubdivisionName: c.citySubdivisionName || '',
          city: c.city || '',
          postalCode: c.postalCode || '',
          country: c.country || 'Saudi Arabia',
          phone: c.phone || '',
          email: c.email || '',
          website: c.website || '',
          logo: c.logo || '',
          isActive: c.isActive !== false,
        })
      } catch (e: any) {
        if (e.response?.status === 401) {
          router.push('/login')
          return
        }
        setError(e.response?.data?.message || 'Failed to load company')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (!formData.name.trim()) {
      setError('Company name is required')
      setSubmitting(false)
      return
    }
    if (!formData.vatNumber.trim()) {
      setError('VAT Number is required')
      setSubmitting(false)
      return
    }

    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        nameAr: formData.nameAr.trim() || null,
        vatNumber: formData.vatNumber.trim(),
        commercialRegistration: formData.commercialRegistration.trim() || undefined,
        address: formData.address.trim() || undefined,
        streetName: formData.streetName.trim() || undefined,
        buildingNumber: formData.buildingNumber.trim() || undefined,
        plotIdentification: formData.plotIdentification.trim() || undefined,
        citySubdivisionName: formData.citySubdivisionName.trim() || undefined,
        city: formData.city.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        country: formData.country.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        website: formData.website.trim() || undefined,
        isActive: formData.isActive,
      }
      if (formData.logo.trim()) {
        payload.logo = formData.logo.trim()
      }
      await api.patch(`/companies/${companyId}`, payload)
      router.push('/companies')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update company')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/companies" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to Companies
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Company</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 border border-gray-100 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Company Name (English) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="nameAr" className="block text-sm font-medium text-gray-700 mb-2">
              Company Name (Arabic) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              id="nameAr"
              name="nameAr"
              dir="rtl"
              value={formData.nameAr}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="أدخل اسم الشركة بالعربية"
            />
            <p className="mt-1 text-sm text-gray-500">If set, shown on the right side of invoice PDFs</p>
          </div>

          <div>
            <label htmlFor="vatNumber" className="block text-sm font-medium text-gray-700 mb-2">
              VAT Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vatNumber"
              name="vatNumber"
              required
              value={formData.vatNumber}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="commercialRegistration" className="block text-sm font-medium text-gray-700 mb-2">
              CR Number
            </label>
            <input
              type="text"
              id="commercialRegistration"
              name="commercialRegistration"
              value={formData.commercialRegistration}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input type="text" id="phone" name="phone" value={formData.phone} onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea id="address" name="address" rows={2} value={formData.address} onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input type="text" id="city" name="city" value={formData.city} onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <input type="text" id="country" name="country" value={formData.country} onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link href="/companies" className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
