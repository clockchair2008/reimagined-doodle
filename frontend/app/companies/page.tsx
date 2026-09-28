'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api from '../lib/api'

interface Company {
  id: string
  name: string
  nameAr?: string | null
  vatNumber: string
  address: string
  city: string
  email: string
  phone: string
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [draftAr, setDraftAr] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCompanies()
  }, [])

  const router = useRouter()

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies')
      const list: Company[] = response.data
      setCompanies(list)
      const drafts: Record<string, string> = {}
      list.forEach((c) => {
        drafts[c.id] = c.nameAr || ''
      })
      setDraftAr(drafts)
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/login')
      }
      console.error('Error fetching companies:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const saveArabicName = async (companyId: string) => {
    setSavingId(companyId)
    setMessage('')
    setError('')
    try {
      const nameAr = (draftAr[companyId] || '').trim() || null
      await api.patch(`/companies/${companyId}`, { nameAr })
      setMessage('Arabic name saved. Re-download invoice PDF to see it on the right side.')
      await fetchCompanies()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save Arabic name')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/dashboard" className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">Z</span>
              </div>
              <span className="text-sm text-gray-600 hover:text-gray-900">← Back to Dashboard</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600 mt-1">
              Manage seller company information — set Arabic name for the invoice PDF right header
            </p>
          </div>
          <Link
            href="/companies/new"
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            + Add New Company
          </Link>
        </div>

        {message && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all border border-gray-100"
            >
              <h2 className="text-xl font-semibold mb-2">{company.name}</h2>
              <p className="text-gray-600 mb-1">VAT: {company.vatNumber}</p>
              {company.address && (
                <p className="text-gray-600 mb-1">{company.address}</p>
              )}
              {company.city && (
                <p className="text-gray-600 mb-1">{company.city}</p>
              )}
              {company.email && (
                <p className="text-gray-600 mb-1">{company.email}</p>
              )}
              {company.phone && (
                <p className="text-gray-600 mb-3">{company.phone}</p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <label
                  htmlFor={`nameAr-${company.id}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Company Name (Arabic) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id={`nameAr-${company.id}`}
                  type="text"
                  dir="rtl"
                  value={draftAr[company.id] ?? ''}
                  onChange={(e) =>
                    setDraftAr((prev) => ({ ...prev, [company.id]: e.target.value }))
                  }
                  placeholder="أدخل اسم الشركة بالعربية"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <p className="text-xs text-gray-500 mb-3">
                  Shown on the right side of invoice PDFs. Left side stays English.
                </p>
                <button
                  type="button"
                  onClick={() => saveArabicName(company.id)}
                  disabled={savingId === company.id}
                  className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:from-blue-700 hover:to-green-700"
                >
                  {savingId === company.id ? 'Saving...' : 'Save Arabic Name'}
                </button>
              </div>

              <Link
                href={`/companies/${company.id}/edit`}
                className="inline-block mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Edit full details →
              </Link>
            </div>
          ))}
        </div>
        {companies.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No companies</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your company information.</p>
          </div>
        )}
      </main>
    </div>
  )
}
