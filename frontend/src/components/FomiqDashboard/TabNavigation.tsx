import { TabType, Tab } from "./types";

interface TabNavigationProps {
	tabs: Tab[];
	activeTab: TabType;
	onTabChange: (tab: TabType) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
	return (
		<div className="flex flex-wrap gap-1 bg-gray-800/50 p-1 rounded-lg">
			{tabs.map((tab) => {
				const Icon = tab.icon;
				const isActive = activeTab === tab.id;

				return (
					<button
						key={tab.id}
						onClick={() => onTabChange(tab.id)}
						className={`flex-1 min-w-0 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
							isActive
								? "bg-blue-600 text-white shadow-lg"
								: "text-gray-300 hover:text-white hover:bg-gray-700/50"
						}`}
						title={tab.description}
					>
						<div className="flex flex-col items-center gap-1">
							<Icon className="h-4 w-4" />
							<span className="hidden sm:inline text-xs">{tab.label}</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}
