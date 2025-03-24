import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	rootPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	rootPath: 'Root.md'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		console.log('onload');
		this.addCustomDiv();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	addCustomDiv() {
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.refreshWorkspace();
		}));

		// this.registerEvent(this.app.workspace.on('layout-change', () => {
		// 	this.refreshWorkspace();
		// }));
	}

	refreshWorkspace() {
		const leaves = this.app.workspace.getLeavesOfType('markdown');
		leaves.forEach(leaf => {
			const editorView = leaf.view;
			const contentContainer = editorView.containerEl.querySelector('.cm-editor');
			const existingDiv = contentContainer?.querySelector('.breadcrumb-div');
			if (existingDiv) {
				existingDiv.remove();
			}

			this.insertBreadcrumb(leaf);
		});
	}

	insertBreadcrumb(activeLeaf: any) {
		if (activeLeaf) {
			const editorView = activeLeaf.view;
			const contentContainer = editorView.containerEl.querySelector('.cm-editor');

			// Check if the view is in edit mode and if the div already exists
			const isInEditMode = editorView.containerEl.classList.contains('is-live-preview') === false;

			if (isInEditMode) {  // This ensures we're in edit mode
				const existingDiv = contentContainer?.querySelector('.breadcrumb-div');
				if (existingDiv) return;
				if (activeLeaf.view.file?.path === this.settings.rootPath) {
					return;
				}

				if (contentContainer) {
					const breadcrumbDiv = document.createElement('div');

					// Use traceToRoot to get the breadcrumb trail
					const activeFile = activeLeaf.view.file;
					if (activeFile) {
						this.traceToRoot(activeFile.path).then((breadcrumbTrail) => {
							const breadcrumbTrailString = breadcrumbTrail.join(' → ');
							console.log('trail from ' + activeFile.path + ' to ' + this.settings.rootPath + ' is ' + breadcrumbTrailString);

							breadcrumbTrail.reverse().forEach((filePath, index) => {
								const link = document.createElement('a');
								link.setAttribute('href', `obsidian://open?file=${encodeURIComponent(filePath)}`);
								link.setAttribute('target', '_blank'); // Allow middle-click to open in a new tab
								link.textContent = filePath.replace(/\.[^/.]+$/, '');

								// Add a separator if not the last breadcrumb
								if (index < breadcrumbTrail.length - 1) {
									const separator = document.createElement('span');
									separator.textContent = ' → ';
									breadcrumbDiv.appendChild(link);
									breadcrumbDiv.appendChild(separator);
								} else {
									breadcrumbDiv.appendChild(link);
								}
							});

							if (breadcrumbTrail.length == 0) {
								const failText = document.createElement('text');
								failText.textContent = 'No path back to ';
								breadcrumbDiv.appendChild(failText);

								const link = document.createElement('a');
								link.setAttribute('href', `obsidian://open?file=${encodeURIComponent(this.settings.rootPath)}`);
								link.textContent = this.settings.rootPath.replace(/\.[^/.]+$/, '');
								breadcrumbDiv.appendChild(link);
							}
						});
					}

					breadcrumbDiv.classList.add('breadcrumb-div');
					breadcrumbDiv.style.marginLeft = '20px';

					contentContainer.prepend(breadcrumbDiv);
				}
			} else {
				const existingDiv = contentContainer?.querySelector('.breadcrumb-div');
				if (existingDiv) {
					existingDiv.remove();
				}
			}
		}
	}

	async traceToRoot(startingFile: string): Promise<string[]> {
		const backlinks: string[] = [];
		const queue: string[] = [this.settings.rootPath];
		const visited: Set<string> = new Set();
		const parentMap: Map<string, string> = new Map();

		while (queue.length > 0) {
			const currentFile = queue.shift()!;
			if (visited.has(currentFile)) {
				continue;
			}

			visited.add(currentFile);

			if (currentFile === startingFile) {
				// Trace back the path from root to startingFile
				let traceFile = currentFile;
				while (traceFile) {
					backlinks.push(traceFile);
					traceFile = parentMap.get(traceFile) || '';
				}
				break;
			}

			const linkedBy = this.app.metadataCache.resolvedLinks[currentFile];
			if (linkedBy) {
				for (const nextFile of Object.keys(linkedBy)) {
					if (!visited.has(nextFile)) {
						queue.unshift(nextFile);
						parentMap.set(nextFile, currentFile);
					}
				}
			}
		}

		return backlinks;
	}

	onunload() {
		const leaves = this.app.workspace.getLeavesOfType('markdown');
		leaves.forEach(leaf => {
			const editorView = leaf.view;
			const contentContainer = editorView.containerEl.querySelector('.cm-editor');
			const existingDiv = contentContainer?.querySelector('.breadcrumb-div');
			if (existingDiv) {
				existingDiv.remove();
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Root Note Path')
			.setDesc('This is where all your breadcrumbs will point back to.')
			.addText(text => text
				.setPlaceholder('Enter your note path')
				.setValue(this.plugin.settings.rootPath)
				.onChange(async (value) => {
					this.plugin.settings.rootPath = value;
					await this.plugin.saveSettings();
					console.log('Root changed to ', this.plugin.settings.rootPath);
				}));
	}
}
