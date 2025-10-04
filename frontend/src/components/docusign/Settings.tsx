"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Save, RefreshCw, Bell, Shield, FileText, Palette } from "lucide-react";

interface DocuSignSettings {
	notifications: {
		emailOnUpload: boolean;
		emailOnSignature: boolean;
		emailOnCompletion: boolean;
		browserNotifications: boolean;
	};
	processing: {
		autoProcessPDF: boolean;
		imageQuality: "low" | "medium" | "high";
		maxFileSize: number;
		retentionDays: number;
	};
	security: {
		requireAuthentication: boolean;
		ipRestrictions: boolean;
		auditTrail: boolean;
		encryptDocuments: boolean;
	};
	ui: {
		theme: "light" | "dark" | "auto";
		compactMode: boolean;
		showPreview: boolean;
		defaultView: "grid" | "list";
	};
}

const defaultSettings: DocuSignSettings = {
	notifications: {
		emailOnUpload: true,
		emailOnSignature: true,
		emailOnCompletion: true,
		browserNotifications: false,
	},
	processing: {
		autoProcessPDF: true,
		imageQuality: "high",
		maxFileSize: 10,
		retentionDays: 365,
	},
	security: {
		requireAuthentication: true,
		ipRestrictions: false,
		auditTrail: true,
		encryptDocuments: true,
	},
	ui: {
		theme: "dark",
		compactMode: false,
		showPreview: true,
		defaultView: "grid",
	},
};

interface SettingsProps {
	className?: string;
}

export const Settings: React.FC<SettingsProps> = ({ className = "" }) => {
	const [settings, setSettings] = useState<DocuSignSettings>(defaultSettings);
	const [saving, setSaving] = useState(false);
	const [activeSection, setActiveSection] = useState<"notifications" | "processing" | "security" | "ui">("notifications");

	const handleSave = async () => {
		setSaving(true);
		try {
			// Simulate API call
			await new Promise(resolve => setTimeout(resolve, 1000));
			// In real implementation, save to backend
			console.log("Settings saved:", settings);
		} catch (error) {
			console.error("Failed to save settings:", error);
		} finally {
			setSaving(false);
		}
	};

	const handleReset = () => {
		setSettings(defaultSettings);
	};

	const updateSetting = (section: keyof DocuSignSettings, key: string, value: unknown) => {
		setSettings(prev => ({
			...prev,
			[section]: {
				...prev[section],
				[key]: value,
			},
		}));
	};

	const sections = [
		{ id: "notifications" as const, label: "Notifications", icon: Bell },
		{ id: "processing" as const, label: "Processing", icon: FileText },
		{ id: "security" as const, label: "Security", icon: Shield },
		{ id: "ui" as const, label: "Interface", icon: Palette },
	];

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Section Navigation */}
			<div className="flex flex-wrap gap-2">
				{sections.map((section) => {
					const Icon = section.icon;
					const isActive = activeSection === section.id;

					return (
						<button
							key={section.id}
							onClick={() => setActiveSection(section.id)}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
								? "bg-blue-600 text-white"
								: "bg-gray-700 text-gray-200 hover:bg-gray-600"
								}`}
						>
							<Icon className="h-4 w-4" />
							{section.label}
						</button>
					);
				})}
			</div>

			{/* Settings Content */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				{activeSection === "notifications" && (
					<div className="space-y-6">
						<div>
							<h3 className="text-lg font-medium text-white mb-4">Notification Preferences</h3>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Email on Upload</label>
										<p className="text-xs text-gray-200">Receive email when documents are uploaded</p>
									</div>
									<input
										type="checkbox"
										checked={settings.notifications.emailOnUpload}
										onChange={(e) => updateSetting("notifications", "emailOnUpload", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Email on Signature</label>
										<p className="text-xs text-gray-200">Receive email when documents are signed</p>
									</div>
									<input
										type="checkbox"
										checked={settings.notifications.emailOnSignature}
										onChange={(e) => updateSetting("notifications", "emailOnSignature", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Email on Completion</label>
										<p className="text-xs text-gray-200">Receive email when documents are completed</p>
									</div>
									<input
										type="checkbox"
										checked={settings.notifications.emailOnCompletion}
										onChange={(e) => updateSetting("notifications", "emailOnCompletion", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Browser Notifications</label>
										<p className="text-xs text-gray-200">Show browser notifications for events</p>
									</div>
									<input
										type="checkbox"
										checked={settings.notifications.browserNotifications}
										onChange={(e) => updateSetting("notifications", "browserNotifications", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeSection === "processing" && (
					<div className="space-y-6">
						<div>
							<h3 className="text-lg font-medium text-white mb-4">Document Processing</h3>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Auto-process PDFs</label>
										<p className="text-xs text-gray-200">Automatically convert PDFs to images on upload</p>
									</div>
									<input
										type="checkbox"
										checked={settings.processing.autoProcessPDF}
										onChange={(e) => updateSetting("processing", "autoProcessPDF", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-200 mb-2">Image Quality</label>
									<select
										value={settings.processing.imageQuality}
										onChange={(e) => updateSetting("processing", "imageQuality", e.target.value)}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
									>
										<option value="low">Low (Faster processing)</option>
										<option value="medium">Medium (Balanced)</option>
										<option value="high">High (Best quality)</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-200 mb-2">Max File Size (MB)</label>
									<input
										type="number"
										min="1"
										max="50"
										value={settings.processing.maxFileSize}
										onChange={(e) => updateSetting("processing", "maxFileSize", parseInt(e.target.value))}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-200 mb-2">Document Retention (Days)</label>
									<input
										type="number"
										min="30"
										max="3650"
										value={settings.processing.retentionDays}
										onChange={(e) => updateSetting("processing", "retentionDays", parseInt(e.target.value))}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeSection === "security" && (
					<div className="space-y-6">
						<div>
							<h3 className="text-lg font-medium text-white mb-4">Security Settings</h3>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Require Authentication</label>
										<p className="text-xs text-gray-200">Require user authentication for all operations</p>
									</div>
									<input
										type="checkbox"
										checked={settings.security.requireAuthentication}
										onChange={(e) => updateSetting("security", "requireAuthentication", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">IP Restrictions</label>
										<p className="text-xs text-gray-200">Restrict access based on IP addresses</p>
									</div>
									<input
										type="checkbox"
										checked={settings.security.ipRestrictions}
										onChange={(e) => updateSetting("security", "ipRestrictions", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Audit Trail</label>
										<p className="text-xs text-gray-200">Maintain detailed audit logs for all actions</p>
									</div>
									<input
										type="checkbox"
										checked={settings.security.auditTrail}
										onChange={(e) => updateSetting("security", "auditTrail", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Encrypt Documents</label>
										<p className="text-xs text-gray-200">Encrypt stored documents at rest</p>
									</div>
									<input
										type="checkbox"
										checked={settings.security.encryptDocuments}
										onChange={(e) => updateSetting("security", "encryptDocuments", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeSection === "ui" && (
					<div className="space-y-6">
						<div>
							<h3 className="text-lg font-medium text-white mb-4">Interface Preferences</h3>
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-200 mb-2">Theme</label>
									<select
										value={settings.ui.theme}
										onChange={(e) => updateSetting("ui", "theme", e.target.value)}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
									>
										<option value="light">Light</option>
										<option value="dark">Dark</option>
										<option value="auto">Auto (System)</option>
									</select>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Compact Mode</label>
										<p className="text-xs text-gray-200">Use compact layout for better space utilization</p>
									</div>
									<input
										type="checkbox"
										checked={settings.ui.compactMode}
										onChange={(e) => updateSetting("ui", "compactMode", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<label className="text-sm font-medium text-gray-200">Show Preview</label>
										<p className="text-xs text-gray-200">Show document previews in lists</p>
									</div>
									<input
										type="checkbox"
										checked={settings.ui.showPreview}
										onChange={(e) => updateSetting("ui", "showPreview", e.target.checked)}
										className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-200 mb-2">Default View</label>
									<select
										value={settings.ui.defaultView}
										onChange={(e) => updateSetting("ui", "defaultView", e.target.value)}
										className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
									>
										<option value="grid">Grid View</option>
										<option value="list">List View</option>
									</select>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Action Buttons */}
			<div className="flex items-center justify-between">
				<button
					onClick={handleReset}
					className="flex items-center gap-2 px-4 py-2 text-gray-200 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
				>
					<RefreshCw className="h-4 w-4" />
					Reset to Defaults
				</button>

				<button
					onClick={handleSave}
					disabled={saving}
					className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
				>
					<Save className="h-4 w-4" />
					{saving ? "Saving..." : "Save Settings"}
				</button>
			</div>
		</div>
	);
};