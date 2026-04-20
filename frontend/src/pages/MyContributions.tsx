/**
 * /my-contributions — premium page that shows the current user's contribution
 * payment history (money they've paid toward events as a contributor).
 */
import { HandCoins } from "lucide-react";
import MyContributionPaymentsTab from "@/components/contributors/MyContributionPaymentsTab";
import { useWorkspaceMeta } from "@/hooks/useWorkspaceMeta";

const MyContributions = () => {
  useWorkspaceMeta({
    title: "My Contributions",
    description: "Receipts for every contribution you've paid towards events.",
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <HandCoins className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold truncate">My Contributions</h1>
          <p className="text-xs text-muted-foreground">All money you've contributed to events you support.</p>
        </div>
      </div>
      <MyContributionPaymentsTab />
    </div>
  );
};

export default MyContributions;
