import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class RsvpPostController extends Controller {
    @service notifications;
    @service store;
    @tracked showSettingsMenu = false;

    // Define filterColumns for name and email
    filterColumns = [
        {
            name: 'name',
            label: 'Name',
            getValue: (member) => ({
                text: member.name || '-',
                class: ''
            })
        },
        {
            name: 'email',
            label: 'Email',
            getValue: (member) => ({
                text: member.email || '-',
                class: ''
            })
        }
    ];

    @(task(function* () {
        try {
            const response = yield fetch(`/ghost/api/admin/frontmatter/${this.model.post.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    frontmatter: JSON.stringify({
                        rsvp: Object.fromEntries(
                            Object.entries(this.model.post.frontmatter.rsvp || {})
                                .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
                        )
                    })
                })
            });
            const responseData = yield response.text().then(text => text ? JSON.parse(text) : {});

            if (response.ok) {
                this.notifications?.showNotification('Event settings saved successfully.', { type: 'success' });
                return true;
            } else {
                return false
            }
        } catch (error) {
            this.notifications?.showNotification('Failed to save event settings.', { type: 'error' });
            return false;
        }
    }).drop())
    saveFrontmatterTask;

    @action
    toggleSettingsMenu() {
        this.showSettingsMenu = !this.showSettingsMenu;
    }
}