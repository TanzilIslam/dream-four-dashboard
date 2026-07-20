"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: number;
  quantity: number;
  unit_price: number;
  ordered_at: string;
  status: string;
  product_name: string;
}

interface CustomerScoreCardProps {
  details: {
    customer: {
      id: number;
      name: string;
      address: string;
    };
    orders: Order[];
    payments: unknown[];
    summary: {
      total_ordered: number;
      total_paid: number;
      total_due: number;
    };
  };
}

// Constants for egg-based protein calculation
const PROTEIN_PER_EGG = 6; // grams
const DAILY_PROTEIN_NEED = 50; // grams per adult per day
const EGGS_NEEDED_PER_DAY = Math.ceil(DAILY_PROTEIN_NEED / PROTEIN_PER_EGG); // ~9 eggs
const EGGS_NEEDED_PER_MONTH = EGGS_NEEDED_PER_DAY * 30; // ~270 eggs per person per month

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

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    if (score >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
  };

  const getScoreInterpretation = (score: number) => {
    if (score >= 80) return "Excellent! Meeting family protein needs well";
    if (score >= 60) return "Good! Adequate protein intake for your family";
    if (score >= 40) return "Fair! Consider increasing purchases for better nutrition";
    return "Low! Your family might need more protein from eggs";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-green-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-green-700">{details.customer.name}</h1>
          <p className="text-slate-600 dark:text-slate-400">{details.customer.address}</p>
        </div>

        {/* Score Card */}
        <Card className="p-8 border-green-200 shadow-lg shadow-green-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Score Visualization */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 mb-6">
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
                  <div className="text-sm text-slate-600 dark:text-slate-400">Score</div>
                </div>
              </div>
              <p className="text-center text-sm">{getScoreInterpretation(score)}</p>
            </div>

            {/* Stats and Info */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Purchase Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-slate-600 dark:text-slate-400">
                      Total Amount Ordered:
                    </span>
                    <span className="font-semibold">
                      ₹{Number(details.summary.total_ordered).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-slate-600 dark:text-slate-400">Total Paid:</span>
                    <span className="font-semibold text-green-600">
                      ₹{Number(details.summary.total_paid).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-slate-600 dark:text-slate-400">Outstanding Due:</span>
                    <span
                      className={`font-semibold ${Number(details.summary.total_due) > 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      ₹{Number(details.summary.total_due).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Nutrition Insights</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Protein per egg:</span> {PROTEIN_PER_EGG}g
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Adult daily need:</span> {DAILY_PROTEIN_NEED}g (
                    {EGGS_NEEDED_PER_DAY} eggs)
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Monthly target:</span> {monthlyTarget} eggs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Family Size Slider */}
        <Card className="p-8 border-green-200 shadow-lg shadow-green-100">
          <h3 className="text-xl font-semibold mb-6">Family Member Count</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-lg font-medium">
                  Members:{" "}
                  <span className="text-green-600 dark:text-green-400 text-2xl">
                    {familyMembers}
                  </span>
                </label>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="1"
                max="7"
                value={familyMembers}
                onChange={(e) => setFamilyMembers(parseInt(e.target.value))}
                className="w-full h-3 bg-green-200 dark:bg-green-700 rounded-lg appearance-none cursor-pointer accent-green-600"
              />

              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>1</span>
                <span>7</span>
              </div>
            </div>

            {/* Updated Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Updated Score</p>
                <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Monthly Target</p>
                <p className="text-2xl font-bold">{monthlyTarget} eggs</p>
              </div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">What this means:</p>
              <p className="text-sm">
                For a family of <span className="font-semibold">{familyMembers}</span>, you should
                ideally purchase about{" "}
                <span className="font-semibold">{monthlyTarget} eggs per month</span> to meet daily
                protein requirements. Your current purchase rate suggests a score of{" "}
                <Badge className={getScoreBadgeColor(score)}>{score}</Badge>
              </p>
            </div>
          </div>
        </Card>

        {/* Orders History */}
        {details.orders.length > 0 && (
          <Card className="p-8 border-green-200 shadow-lg shadow-green-100">
            <h3 className="text-xl font-semibold mb-6 text-green-700">Recent Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-green-200 dark:border-green-700">
                    <th className="text-left py-3 px-3 font-semibold">Date</th>
                    <th className="text-left py-3 px-3 font-semibold">Product</th>
                    <th className="text-right py-3 px-3 font-semibold">Qty</th>
                    <th className="text-right py-3 px-3 font-semibold">Amount</th>
                    <th className="text-left py-3 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {details.orders.slice(0, 10).map((order) => (
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
                        ₹{(order.unit_price * order.quantity).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline">{order.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
