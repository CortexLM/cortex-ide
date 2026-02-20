#[macro_export]
macro_rules! i18n_commands {
    (@commands $callback:ident [ $($acc:tt)* ]) => {
        $callback!([ $($acc)*
            $crate::i18n::i18n_detect_locale,
            $crate::i18n::i18n_get_config,
            $crate::i18n::i18n_load_translations,
        ])
    };
}
