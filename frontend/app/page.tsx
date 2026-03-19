'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Link
            href="/companies"
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-2xl font-semibold mb-2">Companies</h2>
            <p className="text-gray-600">
              Manage seller company information and VAT details
            </p>
          </Link>

          <Link
            href="/customers"
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-2xl font-semibold mb-2">Customers</h2>
            <p className="text-gray-600">
              Manage customer data for B2B and B2C invoices
            </p>
          </Link>

          <Link
            href="/invoices"
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-2xl font-semibold mb-2">Invoices</h2>
            <p className="text-gray-600">
              Create, manage, and issue ZATCA compliant invoices
            </p>
          </Link>
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Features</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Electronic invoice generation</li>
            <li>QR code generation for simplified invoices (TLV format)</li>
            <li>UBL 2.1 XML generation</li>
            <li>PDF invoice rendering</li>
            <li>Hash chaining for tamper detection</li>
            <li>Invoice immutability after issuance</li>
            <li>Audit logging</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
