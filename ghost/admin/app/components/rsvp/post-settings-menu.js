import Component from '@ember/component';
import moment from 'moment-timezone';
import { action, computed } from '@ember/object';

export default class RsvpPostSettingsMenu extends Component {

    settings = null;

    @action
    setCapacity(event) {
        event.target.value = parseInt(event.target.value, 10);
        this.settings.capacity = event.target.value;
    }

    @action
    setLabel(event) {
        this.settings.label = event.target.value;
    }
}