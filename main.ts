import { App, Plugin, MarkdownRenderer, MarkdownRenderChild, PluginSettingTab, Setting } from 'obsidian';

interface MyPluginSettings {
	rootPath: string;
	ignoredTags: string;
	hidePath: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	rootPath: 'Root.md',
	ignoredTags: '',
	hidePath: true
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		console.log('onload');
		this.addCustomDiv();

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	addCustomDiv() {
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.refreshWorkspace();
		}));
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

			const isInEditMode = editorView.containerEl.classList.contains('is-live-preview') === false;

			if (isInEditMode) {
				const existingDiv = contentContainer?.querySelector('.breadcrumb-div');
				if (existingDiv) return;
				if (activeLeaf.view.file?.path === this.settings.rootPath) {
					return;
				}

				if (contentContainer) {
					const breadcrumbDiv = document.createElement('div');

					const activeFile = activeLeaf.view.file;
					if (activeFile) {
						this.traceToRootFirst(activeFile.path).then((breadcrumbTrail) => {
							const breadcrumbTrailString = breadcrumbTrail.join(' → ');
							console.log('trail from ' + activeFile.path + ' to ' + this.settings.rootPath + ' is ' + breadcrumbTrailString);

							breadcrumbTrail.reverse().forEach((filePath, index) => {
								const link = document.createElement('a');
								link.setAttribute('href', `obsidian://open?file=${encodeURIComponent(filePath)}`);
								link.textContent = this.fileNameFromPath(filePath);

								breadcrumbDiv.appendChild(link);

								// Add a separator if not the last breadcrumb
								if (index < breadcrumbTrail.length - 1) {
									const separator = document.createElement('span');
									separator.textContent = ' → ';
									breadcrumbDiv.appendChild(separator);
								}
							});

							if (breadcrumbTrail.length == 0) {
								const failText = document.createElement('text');
								failText.textContent = 'No path found from ';
								breadcrumbDiv.appendChild(failText);

								const link = document.createElement('a');
								link.setAttribute('href', `obsidian://open?file=${encodeURIComponent(this.settings.rootPath)}`);
								link.textContent = this.fileNameFromPath(this.settings.rootPath);
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

	fileNameFromPath(path: string): string {
		var name = path.replace(/\.[^/.]+$/, '');

		if (this.settings.hidePath) {
			const parts = name.split('/');
			name = parts[parts.length - 1];
		}

		return name;
	}

	async traceToRootFirst(startingFile: string): Promise<string[]> {
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
				for (const nextFile of Object.keys(linkedBy).reverse()) {
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
				}));

		// TODO
		// new Setting(containerEl)
		// 	.setName('Ignored Tag')
		// 	.setDesc('Files with this tag will be ignored from backlink traversal and orphan search.')
		// 	.addText(text => text
		// 		.setPlaceholder('archived')
		// 		.setValue(this.plugin.settings.ignoredTags)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.ignoredTags = value;
		// 			await this.plugin.saveSettings();
		// 		}));

		new Setting(containerEl)
			.setName('Hide File Path')
			.setDesc('File paths will not be shown.')
			.addToggle(text => text
				.setValue(this.plugin.settings.hidePath)
				.onChange(async (value) => {
					this.plugin.settings.hidePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
