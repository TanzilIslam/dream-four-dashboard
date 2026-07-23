"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";

interface Order {
  id: number;
  quantity: number;
  unit_price: number;
  ordered_at: string;
  status: string;
  product_name: string;
}

interface Payment {
  id: number;
  amount: number;
  payment_method: string;
  paid_at: string;
}

interface CustomerScoreCardProps {
  details: {
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
  };
}

// Nutrition target: one egg per day per person
const EGGS_NEEDED_PER_DAY = 1; // one egg per day per person
const EGGS_NEEDED_PER_MONTH = EGGS_NEEDED_PER_DAY * 30; // 30 eggs per person per month

export function CustomerScoreCard({ details }: CustomerScoreCardProps) {
  const [familyMembers, setFamilyMembers] = useState(1);

  const { monthlyTarget, score, scorePercentage } = useMemo(() => {
    // Calculate total eggs ordered
    const totalEggs = details.orders.reduce((sum, order) => {
      // Assuming quantity is in dozens or units
      return sum + order.quantity;
    }, 0);

    // Calculate monthly target for family size
    const monthlyTarget = EGGS_NEEDED_PER_MONTH * familyMembers;

    // Calculate score (0-100)
    // Score represents how aligned customer purchases are with nutritional needs
    const scorePercentage = Math.min(100, (totalEggs / monthlyTarget) * 100);
    const score = Math.round(scorePercentage);

    return { monthlyTarget, score, scorePercentage };
  }, [details.orders, familyMembers]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-blue-600 dark:text-blue-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreInterpretation = (score: number) => {
    if (score >= 80) return "চমৎকার! আপনার পরিবারের প্রোটিনের চাহিদা ভালোভাবে পূরণ হচ্ছে।";
    if (score >= 60) return "ভালো! আপনার পরিবারের জন্য পর্যাপ্ত প্রোটিন পাওয়া যাচ্ছে।";
    if (score >= 40) return "মোটামুটি। আরও কিছু ডিম কিনলে পুষ্টি আরও ভালো হবে।";
    return "কম! আপনার পরিবারের জন্য আরও বেশি ডিম প্রয়োজন।";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-green-700">{details.customer.name}</h1>
          <p className="text-slate-600 dark:text-slate-400">{details.customer.address}</p>
        </div>

        {/* Order & Payment Summary Card */}
        <Card className="p-8 border-green-200 shadow-lg shadow-green-100">
          {/* Order Summary Table */}
          <h3 className="text-xl font-semibold mb-4 text-green-700">অর্ডার সারসংক্ষেপ</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-200 dark:border-green-700">
                  <th className="text-left py-3 px-3 font-semibold">তারিখ</th>
                  <th className="text-left py-3 px-3 font-semibold">পণ্য</th>
                  <th className="text-right py-3 px-3 font-semibold">পরিমাণ</th>
                  <th className="text-right py-3 px-3 font-semibold">দর</th>
                  <th className="text-right py-3 px-3 font-semibold">মোট</th>
                </tr>
              </thead>
              <tbody>
                {details.orders.length > 0 ? (
                  details.orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-green-100 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-800/50"
                    >
                      <td className="py-3 px-3">
                        {new Date(order.ordered_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">{order.product_name}</td>
                      <td className="py-3 px-3 text-right">{order.quantity}</td>
                      <td className="py-3 px-3 text-right">
                        ৳{Number(order.unit_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        ৳{(Number(order.unit_price) * Number(order.quantity)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      কোনো অর্ডার পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payments Table */}
          <h3 className="text-xl font-semibold mb-4 mt-8 text-green-700">পেমেন্ট সারসংক্ষেপ</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-200 dark:border-green-700">
                  <th className="text-left py-3 px-3 font-semibold">তারিখ</th>
                  <th className="text-right py-3 px-3 font-semibold">পরিশোধিত টাকা</th>
                </tr>
              </thead>
              <tbody>
                {details.payments.length > 0 ? (
                  details.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-green-100 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-800/50"
                    >
                      <td className="py-3 px-3">
                        {new Date(payment.paid_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-green-600">
                        ৳{Number(payment.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      কোনো পেমেন্ট পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-8 space-y-3 border-t border-green-200 dark:border-green-700 pt-6">
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
              <span className="text-slate-600 dark:text-slate-400">মোট ক্রয়:</span>
              <span className="font-semibold">
                ৳{Number(details.summary.total_ordered).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
              <span className="text-slate-600 dark:text-slate-400">মোট পরিশোধ:</span>
              <span className="font-semibold text-green-600">
                ৳{Number(details.summary.total_paid).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
              <span className="text-slate-600 dark:text-slate-400">মোট বকেয়া:</span>
              <span
                className={`font-semibold ${Number(details.summary.total_due) > 0 ? "text-red-600" : "text-green-600"}`}
              >
                ৳{Number(details.summary.total_due).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>

        {/* Nutrition Score Card (simplified, Bangla) */}
        <Card className="p-8 border-green-200 shadow-lg shadow-green-100">
          <h3 className="text-xl font-semibold text-green-700 text-center mb-1">পুষ্টি স্কোর</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-8">
            ডিম প্রোটিনের একটি সহজ ও পুষ্টিকর উৎস
          </p>

          {/* Family member selector */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <label className="text-base font-medium">আপনার পরিবারে সদস্য সংখ্যা</label>
              <span className="text-green-600 dark:text-green-400 text-2xl font-bold">
                {familyMembers} জন
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="7"
              value={familyMembers}
              onChange={(e) => setFamilyMembers(parseInt(e.target.value))}
              className="w-full h-3 bg-green-200 dark:bg-green-700 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>১ জন</span>
              <span>৭ জন</span>
            </div>
          </div>

          {/* Score gauge */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="relative w-40 h-40 mb-4">
              <svg className="w-full h-full" viewBox="0 0 180 180">
                {/* Background circle */}
                <circle
                  cx="90"
                  cy="90"
                  r="80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-green-200 dark:text-green-700"
                />
                {/* Score circle */}
                <circle
                  cx="90"
                  cy="90"
                  r="80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(scorePercentage / 100) * 502.4} 502.4`}
                  className={getScoreColor(score)}
                  style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">স্কোর</div>
              </div>
            </div>
            <p className="text-center text-base font-medium max-w-sm">
              {getScoreInterpretation(score)}
            </p>
          </div>

          {/* Simple stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">মাসে যত ডিম দরকার</p>
              <p className="text-2xl font-bold">{monthlyTarget} টি</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">আপনার স্কোর</p>
              <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</p>
            </div>
          </div>

          {/* Simple explanation */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm leading-relaxed">
            <p>
              একজন মানুষের প্রতিদিন অন্তত{" "}
              <span className="font-semibold">{EGGS_NEEDED_PER_DAY} টি ডিম</span> খাওয়া ভালো। তাই{" "}
              <span className="font-semibold">{familyMembers} জন</span> সদস্যের একটি পরিবারের প্রতি
              মাসে প্রায় <span className="font-semibold">{monthlyTarget} টি ডিম</span> প্রয়োজন।
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
