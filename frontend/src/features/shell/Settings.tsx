import { useSettings } from '../../data'
import type { PnlScheme, ThemeChoice } from '../../data'
import { IconButton, IconSettings, IconThemeDark, IconThemeLight, IconThemeSystem, Menu, MenuRadioGroup, MenuRadioItem, MenuSeparator, PNL_SCHEMES, RadioGroup, THEME_CHOICES } from '../../ui'
import { PNL_GROUP, PNL_LABEL, SETTINGS_TITLE, THEME_GROUP, THEME_LABEL } from './copy'
import { GuideMenuGroup } from './GuideEntry'
import styles from './Settings.module.css'

const THEME_ICON: Record<ThemeChoice, typeof IconThemeSystem> = { system: IconThemeSystem, light: IconThemeLight, dark: IconThemeDark }

/**
 * The settings menu of the top bar: the theme and the colours of gains and losses. Each choice applies at once
 * and is remembered in this browser (the data layer stores it); the menu stays open so a choice can be compared
 * with the next. The welcome guide's replay entry closes it.
 */
export function SettingsMenu() {
  const { theme, pnl, set } = useSettings()
  return (
    <Menu size="tall" trigger={<IconButton label={SETTINGS_TITLE} icon={<IconSettings />} />}>
      <MenuRadioGroup<ThemeChoice> label={THEME_GROUP} value={theme} onValueChange={(next) => set({ theme: next })}>
        {THEME_CHOICES.map((choice) => {
          const Icon = THEME_ICON[choice]
          return (
            <MenuRadioItem key={choice} value={choice} icon={<Icon />}>
              {THEME_LABEL[choice]}
            </MenuRadioItem>
          )
        })}
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuRadioGroup<PnlScheme> label={PNL_GROUP} value={pnl} onValueChange={(next) => set({ pnl: next })}>
        {PNL_SCHEMES.map((choice) => (
          <MenuRadioItem key={choice} value={choice}>
            {PNL_LABEL[choice]}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <GuideMenuGroup />
    </Menu>
  )
}

/**
 * The same settings as plain controls, for the More sheet on phones, where a menu inside a sheet would be a
 * second layer. Each is a radio group with one tab stop; its options wrap onto a second line when the phone is
 * too narrow for one, so none is ever cut.
 */
export function SettingsControls() {
  const { theme, pnl, set } = useSettings()
  return (
    <div className={styles.controls}>
      <RadioGroup<ThemeChoice>
        label={THEME_GROUP}
        orientation="horizontal"
        value={theme}
        onValueChange={(next) => set({ theme: next })}
        options={THEME_CHOICES.map((choice) => ({ value: choice, label: THEME_LABEL[choice] }))}
      />
      <RadioGroup<PnlScheme>
        label={PNL_GROUP}
        orientation="horizontal"
        value={pnl}
        onValueChange={(next) => set({ pnl: next })}
        options={PNL_SCHEMES.map((choice) => ({ value: choice, label: PNL_LABEL[choice] }))}
      />
    </div>
  )
}
