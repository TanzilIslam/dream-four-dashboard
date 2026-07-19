"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./loading-screen";
import { PhoneVerificationDialog } from "./phone-verification-dialog";
import { CustomerScoreCard } from "./customer-score-card";
import { Card } from "@/components/ui/card";

interface Customer {
  id: number;
  name: string;
  phone_masked: string;
  phone_last_two: string;
}

interface Order {
  id: number;
  quantity: number;
  unit_price: number;
  ordered_at: string;
  status: string;
  product_name: string;
  product_unit: string;
}

interface Payment {
  id: number;
  amount: number;
  payment_method: string;
  paid_at: string;
}

interface CustomerDetails {
  customer: {
    id: number;
    name: string;
    address: string;
  };
  orders: Order[];
  payments: Payment[];
  summary: {
    total_ordered: number;
    total_paid: number;
    total_due: number;
  };
}

interface CustomerScorePageProps {
  initialName: string | null;
}

export default function CustomerScorePage({ initialName }: CustomerScorePageProps) {
  const [loading, setLoading] = useState(!!initialName);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers when name is provided
  useEffect(() => {
    if (!initialName) return;

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/public/customers/lookup?name=${encodeURIComponent(initialName)}`);

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "No customers found");
          setCustomers([]);
          return;
        }

        const data = await response.json();
        setCustomers(data);

        // If only one customer found, auto-select
        if (data.length === 1) {
          setSelectedCustomer(data[0]);
          setShowPhoneDialog(true);
        }
      } catch (err) {
        setError("Failed to search customers");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [initialName]);

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowPhoneDialog(true);
  };

  const handlePhoneVerification = async (phone: string) => {
    if (!selectedCustomer) return;

    try {
      const response = await fetch("/api/public/customers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Verification failed");
      }

      const details = await response.json();
      setCustomerDetails(details);
      setShowPhoneDialog(false);
    } catch (err) {
      throw err;
    }
  };

  // No name provided - show empty state
  if (!initialName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Customer Score</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Visit this page with a customer name parameter to get started.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Example: /score?name=John
          </p>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Customer details loaded - show score card
  if (customerDetails) {
    return <CustomerScoreCard details={customerDetails} />;
  }

  // Phone verification dialog
  if (showPhoneDialog && selectedCustomer) {
    return (
      <PhoneVerificationDialog
        customer={selectedCustomer}
        onVerify={handlePhoneVerification}
        onCancel={() => {
          setShowPhoneDialog(false);
          setSelectedCustomer(null);
          setCustomers([]);
        }}
      />
    );
  }

  // Customer selection view
  if (customers.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <h2 className="text-2xl font-bold mb-6">Select Customer</h2>
          <div className="space-y-3">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className="w-full p-4 text-left border rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
              >
                <p className="font-semibold">{customer.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{customer.phone_masked}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Error</h2>
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
        </Card>
      </div>
    );
  }

  return null;
}
