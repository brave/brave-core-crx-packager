/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

 const childProcess = require('child_process')
 const commander = require('commander')
 const fs = require('fs-extra')
 const mkdirp = require('mkdirp')
 const path = require('path')
 const replace = require('replace-in-file')
 const util = require('../lib/util')

 const getComponentDataList = () => {
  return [
    { locale: 'iso_3166_1_ca',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwSGYa6ZpRmQQNSXZDZCMRZYyUXKqyCaDkHb8mucgKbNCNkwOTgqMKv1dqi1fZrniIIR/dLHb9YwX+gfWb8ZaO5Xhm9H5iqTpo9qk5g0zM7Ba9+2h0nJVPjSuPen84rvzuKqx17I+6GTIc8j/E1O7uRWaqBqLAOHfMAusJNtVSpXlFAvn8iPO3oIxzPwkATVEzc1jLQgxkdVkBZ67Ivp6jRkLd9T5Q2XtcJ6wr0CEzO9ypimyu2NM5Xkfzza0xE54LddrNbFcATg/wpx5B5Mw7zMgEDIhTkaOnv+pHgpKwMamlazH9ivmXvxfR/ToX3uRY+STapbJ4dkd7UBH3XqGWQIDAQAB',
      id: 'lgejdiamednlaeiknhnnjnkofmapfbbf' },
    { locale: 'iso_3166_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsem6Ih5+e6dxLjuak9R9hrx/XShs8N+pLqnvoYSqj5XT8d64kC24u7/QOUNvn9lcawT4wikmmHjRB0yDO9VU+Gltm52jFBVlpBaCKAT+cd56D+seIo6IaFnb42tv5wDQ1yQqvEFr2BOTdd5DX8lRmdQLWGZ2zm294xsih8ZjDZtO8CDtlFpUTwv0iGo30aOF6TcWrZ988h0zolO1xMh5MYIJs54+GYqF1cNjk+p4WJl4q/aWdgTxbzIAVvaJUavxYhYwQ0SzlFHDAa24diExS+VC/R+W5ymi7J/V5QPwXpld9sBfRW9/LFIdyzbeGkYtgNCsQPw5J1/FREfD/YZmowIDAQAB',
      id: 'jcncoheihebhhiemmbmpfhkceomfipbj' },
    { locale: 'iso_3166_1_jp',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3SIk4j5tQcE9rzhvy2yZovJm5eMF38O1epzXtYGN/kNzQ5VoZy5c+2uUnEcVa/VVsqSZKuWXkqz//OlJ5tDbWKH2bMVYvOXU9QuBqK6ZKrmvsAziO+fxd8LeW/wV6WLLxE8lZKOQ/JCGfj5lYh0cqeLDfWsZcb+odDW7ecKfrfqKZFI+wJeGBLv8nbMmvFApqxP0o33pMihX0McQ62A+pjzB8QbBADu0/+lKb9LkNi34FrTp0AQhSoOWHFYAaqW3/jYIG47/EvmsEiJYwp0/HN5XhHWrdTBTLlLkG9672PslNJYqv57CbOB0yPGKAELTXZzxDNEkPQ2CNV/t4kDlNQIDAQAB',
      id: 'ikolbkmkinegpoedjeklhfnaidmloifj' },
    { locale: 'iso_3166_1_gb',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAttE8dno9TryntLQd2qNsHfmEJDzC2owHBcaPk6j0CEliD+NWiPAD0YmRZc+ckeXsahc5Bwh/Xz1WOzQJLXre8K8qPQhTh+uICNZ88VAWDiyXZQD20BeBZc3qhvHuKE1i1lsEbZzv3KocLCkPloP1Aihvdit8Chia/0KPxgMR1W6gZutg4gQiGVHu3fy99PC+0OVrC0HbHK+8UnNSAdi/oLuovXIfiYWJPCeK4HaeRJRfsWPBr6tWULz9Yz14g4DlujviLAJQwpOrstnFKZNkL4d++q7t3oLN7TSBf84iwimJCcR8sssmFUCOnd183s2PRCJCT9/jgTziUNTROeS/eQIDAQAB',
      id: 'cmdlemldhabgmejfognbhdejendfeikd' },
    { locale: 'iso_3166_1_us',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7xPk/eeslWG0VSSjMExUQtvn+8Ww8wCuluf97ACxiAoSspSrU1ftrjGw7U72YCKgPk1EdNKyOYpP1jQT0idxrhpTqihJQLlHm5EN3MiLDVf6MK8dqyG4PVAALMTGW6+4c77QhqnVWIRnfep96WBnJo0x5QieMWDZY79k4QMqJ2/NXMbGxyLWrNyXNy7zEnu5O/lLn68dM2it2KaQnXwCWj9DUoeaP6HTbBAgFYFE85b3nuSNX4RJfuEAod4lqdOgGsUuF/99AyCPVijuveYPrKxiBzvTcHb5GWoeKqjLi9rrqEwgxHgHZEANtIvORNQT40Q5OX+WntI1rkhn9UgMiwIDAQAB',
      id: 'iblokdlgekdjophgeonmanpnjihcjkjj' },
    { locale: 'iso_639_1_ar',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2OYfSf6BBCChY+bV+5QY0AMKh53vsvg0RBR+Lo0ZiMKgO/cW9aVi8UWHSybHv3NbiTaInl0ynitcQ7H9JOT0V5/MSpM05lWorhgQxQUc0FeD5GQIggPopAW86AlntX3ZdAjdZnB0q8STJeSdJiE+wWejC5eOIz6b3pbXldAtDPMtVDD/RxDWquddv5igEjLj39GggduCQJj+S5JtRuqJ+DB27+f5HqUMSzvhjnssYnQMCq50wT9AeDnKw6nMvCxhFh4u4Rq24PCjPduGen9iuTyRfdBbDqt6sMmlgwmAEd5nBSZD4tN4Xw8Z0JSx8mRJv6x1SZV30XCQoiqJglJABwIDAQAB',
      id: 'knjanagkmnjgjjiekhmhclcbcdbjajmk' },
    { locale: 'iso_639_1_zh',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5gsdeMl6rI/OmDF5uxPEMJ+7CyMDDHoi61AZS+cp+DquTRWRvgPgwde5G/xihE3kIfcyG9yfRtxH11c7ftTCmbdE+h8Q+10ERbP5yHf2ZeYhSr8XqzZdfoppxRpqIerRl4gtPxuEek/yLJRBnjaBqbljHOTEe2Wh1tbS3jAWd+joPE1HVU2rz/axo1t/M8Ge+IWp38xOu7lss7118imi+RiePg1+dNt+F0aP2IjIw4COAF4CIaMqvhJEh/oupZJ6vNsciqJ/xRE+N6bSoZ6xSV4XvCj6S1LKwKa/ssyCsWkQtKCClfQKBh3enpB1p4Inwl1sybsLqp/P7Y2ixbHIAQIDAQAB',
      id: 'clegognodnfcpbmhpfgbpckebppbaebp' },
    { locale: 'iso_639_1_nl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqmvrb9bQRc3l6huDHj2XAICyzaGpqCFJhmEeYt3MwoCUAol2BwYCjLJiVSl2h7raeukW0HSZGj+VO89SUDjeGKPmDqNjZ5UOTHcTEsUTvOTdjV40g7/6OYEA70KkMQyz2ep2Rpb4ep+Us6+9K/X9JtGni5PbeB2ksl91ZH3AYnfpAMa6pFXGO54L3IA5Uj4EPx7cdCy24g0jrNN33WOA6DPTGaGhvrAmaTjj5AGuPmf3RRfr6Mo8+dNqpIRuhm4OQPHq0JNhupKXedTvuKGabgqQPr7VrL9YScz+s4mdioi95x65KixKf9+ugKBvesWgkDILC801jkA8GOcUiW7WWQIDAQAB',
      id: 'neglbnegiidighiifljiphcldmgibifn' },
    { locale: 'iso_639_1_en',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp3999qnB5RBaRYj2VwIgbHUyPrfwXsFVn8apmCcT23UHO33cAGHDVKSKvmpXn1L+jBfThPjY9EtW5yA1+6tmC7iJIesJjWbM/G/JA9Btc6f58a0xuPa86goCM10/EocttsoheOzi7A4DUGqCAhBh2HwhzRWxmJnYURtYJz5jX+gLbE8m0mxHZLktKIBPVqw3CbKeWN5kU1Pppg+Wh/xdTxOXhwBo6MNWog+oZEzSSvJ5zY1/vfX0VIMVYiHyNFvyNf5Bdu7aK9PDj3iQs6s5Ru7ahAQg2RglbvI7Axr4eSgKaxg6k/n6h83ltWdAoZqwbC07U0NIb9MtXmZLU76+OwIDAQAB',
      id: 'ocilmpijebaopmdifcomolmpigakocmo' },
    { locale: 'iso_639_1_fi',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA/ktF4Z+J4NV0Ayqp51DskjYkwYG/73SuLt2LOWQ/MVwGSPtso76T7WCc9LwNsr6e8L+k+rJRbSSHBoR9/Gn14uKqgWupdS32YNtG/m4aBBKnLiL6z4uA2ySwjxgqHigASd4X1xYhYdnUzp6ie53WEukL++ASAJcxY9PBxitJY5R8wRLTcwF19Ch6dpvpjdya4VgS3TS9ZDX3ke6cNfst834fHcVQQX+ifs4LKSWUQmril1nncIPv/yMlwKxwZ0MEoqdNh2xH+eM5QcXaskw2uAnEUfb3nR2PLnWjfHkMzScHeMeMImEXq2hODw8xbKDGGDFiOrXq/tp3WVkTxbXNKQIDAQAB',
      id: 'lbbgedbjaoehfaoklcebbepkbmljanhc' },
    { locale: 'iso_639_1_fr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtBB7yfrHKi2vECmykInlWDq8WZ8kYC9APdGjyFrWJlO8/xjokj5ivaDrSiEfmaqmYyx21C5+UcMSEPcjChLpO1KrzhR6xwFEFiwy3brXDwBWdov7QhG2XY10328FxITd1rcgsOYtXsvpIYqPDZWDs52vqkVfrXQAtsHhkadngAGpRNxzpaqZCOz7SclJO9QCSUo2ZZ0CbgA9TOXGlR5UKF8amY1Voz5oEPrZfsfTdmYh8+r1uKOSSD7+acEf+UHWHpWRD1nrHz1Y1tak2hcgFMIB8Y3RCrdV43JLEQRLE/Wo5Oda08BJdZttLmHkOHBzuGX5vnH5f9kRCNv/d66fLwIDAQAB',
      id: 'ijgkfgmfiinppefbonemjidmkhgbonei' },
    { locale: 'iso_639_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqyx9DxzGb/rzZQ6B4LWax/AkJ9Q7LUeHqEg1TqaoFZqbjw7YqEtRc2yfX7siPi1V/ZeD3kIglf+ylrXmd1EPlZSqdhjbBwl6BQqQTChawDQtOtOVtr6GciEsicGGBQNTTBAUi6cqwsryL1JDdVnN0QOh9q8MNZ2rDbMuOc1E7Hm3h3DWY/vWAnhYwoFkxszohc3rknZjJglxikwh/e2CbsoEE2kBXuTrj5Y0PMySHl9eom7EMHyZTzl6m5ucjqNW+4Wq4uwfqJYKaxVpiPbuhQaAx2gcFdU62a63+i4PFR9vknoP5vXvQVHgc/AXrprbjwQfewl61RAE10fmaYxvzwIDAQAB',
      id: 'bbefpembgddgdihpkcidgdgiojjlchji' },
    { locale: 'iso_639_1_el',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwUa3aSn/xVbyNvd9ycV/L7NH+QxAY6yHgRulcoDAj6cOq2JE+v5aLuTSximfx0tVxsO0YlP70OCkOXURM3joGJ0sZWQrVO2al6DgZrmAljAoaOeTTfCmSspxNroM2VWj2gGxfvM351CaAlspQQmKfdPEy4I89Jas/wl8Or6eB2uV4fi+cDcfECIjiksMtegn4LHxcOYlO+LDOb4R0PcbLjzH9RCiBAEKlO4xRXuAiuqRhl0HHH4fxnxsSE+mNJ5hMobo/HbbExrceJhdDb8rlsoQBupGTnHHFlZuzCJpotwypc5YRe/iheDdG0GRN+ac16y215n4CV+VgDMqGeVsvwIDAQAB',
      id: 'hgcnnimnfelflnbdfbdngikednoidhmg' },
    { locale: 'iso_639_1_he',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1UlQC0zswsRtGkZd/+XFqQebBRE/RbupQymPaMEAOjKtYsRFZDqKJwuDGCTJHuztzBQXugpLF9ntIrYkpdkv9abvI2C9mEr5l54uHleJdpmqYdXvZOmzaVH6ywtbVoSSS0Y2Q3TYfSh9h17jAFE/j0cL147Arr5F1KCLQsVApKMa+8yU0mzyJnfDhUjUwXkbS8w0KQCCLQeuQo+j9PUTQ4QJcrChi4dX7wlrGh2OW7F4Go5EwCXuEwIlGjY+ckLvY/Tvkmqb6hf3aJxY56LX6DL2sQxPPr0+gaJdhp5UA/0eTrBX9DIVFk/t0yPtLhVJZR5tr4ERcOMFYbsbqsiPywIDAQAB',
      id: 'biklnlngpkiolabpfdiokhnokoomfldp' },
    { locale: 'iso_639_1_it',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAscnSMLfsPmH6aTP6ADhma508Oi2ug+LUAyvL/P3fKug78bji88HLVXwqgrkZ/yGhOr7UjE5LSsDKfrxHY9AEtNDzgbIBN3QugHjNJUdNTrbT2Z6q/5eX3Vjx5/rwnP1YoRRt4gQcii3j3SQK8p20KrNKKoa3DGu+EdKhFLoXs8GJxlI49lmXY5Qeugs78qpYV8Miq4j0jKh6yEhHWj5eLDi4Xc5fC9SEb0n09KHqka97dkesF9y72xxyrJf9FrV4RZFKcAMEOjZLW6I9ZWiSVKcEeAZDd0ugVWe9iL/ml8IwOD1HdHh/1ROrlWIwuxoNHh9qGiXl4tF8/KcAf4evgwIDAQAB',
      id: 'apaklaabmoggbjglopdnboibkipdindg' },
    { locale: 'iso_639_1_ja',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsv0yCEjWOtSR8uZJvHCeUY9LrfvlxB915s/rMPAEMm5cKyDySJm/CRV0SZIl+4Ntxqd8axkbvNuMrz1Sy7M4NcIHOiWetOu3h8W+b1VfLrX+JLlLVVS6uxTm/h3ymz7UF9+ymiXIfqBkZ3UZTFXPU3J3HsSMLKiqogYtBNtudh5Bz51fAVB4PLjWHqnTFk037702zLda1aqhw/Jodg0IR63M5sIoX5qF4te5k/MmTNyqs/AUfhxvRQjkTOviAovQcOew6uD01qtzQ6LrVj77H4EgnyYobO8cjphw+jwuBeFBnfwMv7QtmGjIyNa/vgTE5w2EA/ltjw3QfwYNYWg1eQIDAQAB',
      id: 'anbffbdnbfabjafoemkhoaelpodojknn' },
    { locale: 'iso_639_1_ko',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkG4PYLf8y9XUDoTCpZxaJ/GAnj73lUZnbOhUxhhYrrPYaHgeU3D8jdJKW/684YZpq5mFwrRTR+MJR6z8Yq/Rlp2aglilQtO/YXBU9FAUVcZQ/PGLnLT5OTsDVQEFcMSDZXttpqNlhiJM1Lp1i69i1j3nTM86lVY3LFJ/hBIdqvDkFR/k4Ri8z7LbKGHWbIIXfN1lGffxenhAbBqYE0dCMw3k7AjbbsGL81XyFbKZYmLhP2c/59Ojh09EPYJeEQc97oHbTzdPmQGM6O2OycJ/QoMHyx2RMaQHcvAVCCAjw9t9aaPTSUEXMekMoEETRzB2UJV0eydYyHsYC0R/UuPGmQIDAQAB',
      id: 'deadocmlegcgnokbhhpgblpofkpkeocg' },
    { locale: 'iso_639_1_pl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArN+OYr0QsIOuRUGSMOWwPCYRh7f0R+4RibHxY41NpJ7SIiH8nMnOj9eT1oqH1TioW7et/z5vuiX5ma4KloVXAssZV46lATzjDm2mYLlC3Si2snD2NZD0CVAtjWEm3RHBX/giUnBXa/SkxHEwd1Np78YT4R6BJndD1akIqLTMSx1V4OFCkQNsLXdkvkKyfqspR0T4aRfqOZ9Ksr9qNARVHVVtBh/M1V8k7TheGW/V8YfopC18X3ejRWtYcKGc71N3RJc5HveZwz7oap+MpZMdkg/GvgqGqVIom1WbmM4YX7b16RX9TcLKcr8NorVfd62bXxBK2AocaPYNBdD5nrPjrQIDAQAB',
      id: 'fojhemdeemkcacelmecilmibcjallejo' },
    { locale: 'iso_639_1_pt',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0uaRGqhb7rr5jk7hzWo7Uze61YQpbOr62ULTKoOTtmQKjA1n7x/Hwl5CoBMeZ3l/3JbWKYfhffhX+9zziy3dNqJE5lor3mT2IUAJOf3qTFQKSJu0Oy6/v+csW+w9qVg6xA3MG0DCG22u6dRNqBH9OFsrWUFNpuq23uKAy0XBEHzbgNh95GF2FAMVrwG8nZ2EAcRiOxjrYYuE0MF3ztLG9SsX6ZsaXSiHt90e23RmCgGYqVutQ0255T1B7K3SULdiSSKFtaGamWGVzdlo+SNecjF3/e12760VYOkGM+KmokR4r0VnrXaOUUlJ382Tl5KC9H1Sn5UOmEc9+Kqm3uf6PQIDAQAB',
      id: 'fimpfhgllgkaekhbpkakjchdogecjflf' },
    { locale: 'iso_639_1_ro',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu9aWzfXi84tAS6V3Sqt3VKUGWyCmyMln30f1XZCkUYT0brpt1r6r3R5axRTBDxn9xoj8w6aEVrNGnaz61uAi4fE1BN6cR7uHrU7YkqU6rvm8RUHIDjBRTUBLbOrW7aoPHCpgpmpuvy6NqfvRuJwpDP6zmRaJQb7csUceTP+EbkKUpdB6Y34ifB7+/rlH/OPXLiZEMV0JPQwHYEAZfQqRbZILuxF+N4RmQnvJy7WwAGifsTtkTaMMpYq0K2MMT3r0sCz3A7Lrd3XmxUjdIMNLFqO0cVvgOUZOHBqyx/N2JZsVceapgqBuDT8fmUiCIPIBb610MFpDDhqvsvTZXP6O5QIDAQAB',
      id: 'ohhkknigpeehdnkeccopplflnodppkme' },
    { locale: 'iso_639_1_ru',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxSqvZTHCbM8uvgP8Vt0XDs9jq5OKNMx1/iL6OzZOoZU1RZY0+bkH25gnanfg944KVn8hjiialPpm+W4FYqyAB2fM9KXKsL7NDUDykfQ+t4C8fmcaT0e0SGVKXd8fCA7ZdzqVFxIzFmZetcRwUaCoHLwj+y5P7qACbCEkgVSRryEbrknYgBuVx96nSs8YqlFFFqnOIvChqprJM8TfiCxbDHt/kIQXFwra2LJJDFHXxiH5LDKMMxIF9x1EXJVLP+xr6x3KF1KHwdl+yUq8/ItrQ7qzltKqS5Jgm88DlzJQAj1F08gvt0M8BEnXroQ9jII7ZQLfLwjNIwswrOW0FhhenQIDAQAB',
      id: 'jajlkohoekhghdbclekclenlahcjplec' },
    { locale: 'iso_639_1_es',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv0BM4xF02OwjKxXbWA5EYzHOGQoK6enQBFPDy6nzOqSk02qpn6jDGpfbWi1rCsxp5RoBO8uhZLO4O/aJOGok9zQ/SuzhQDcgB08l1NwCwMQEojrkMKo64cQaymN5WUictvEOIn0bD4X2H0+BzIl/QJFOwGiZDIiw5ducDlXq8ciWKxN2ZZv4gIV1S5mm23x4/Qj8RY+uHV7+dSTSAYswG2+gjuULj+cPSlmaJHcNs/HWaeg+gSwTxYcMEK7keuEf0YMbN7vfGT3Zx+dmB67uMZ8fAR0tjSeNizpzaoUdrXA/okA04+v64+5YCyPuU+zzVk+NoP6UbKhvHTLJGGqK/wIDAQAB',
      id: 'elecgkckipdmnkkgndidemmdhdcdfhnp' },
    { locale: 'iso_639_1_sv',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwDlwUKHo9kRxqiV1adihhdgwa+Cz+fZpS2yF61qHz4EneEyKvvP9bhyvLZisvjBpU68H3+laKrOraTZ0I0qXwCjMjmb7wUfjRRLJYyOpjPaPQ3GWirIZ9ql8uw6a5Q66XVzwkH4t05Dv3owE2WnCAWJGjQuEUuTlZO0V92vIYg8QeA0ecKOsMuhEDkT8alsKD+1SSpvGxhFVF7TcCDe9HvQc9IjazymbgjjuSkQx4P7eE8z2ZdqdgtKAyccMkjUsvzZ4mi3DxWqXDu406VQTaGNpZwj2iJHKYum3DgM7BdHWfU8kgrTeWgSaESp9d5lanpyRR/1Pcz55dloya9sLBwIDAQAB',
      id: 'lnhckckgfdgjgkoelimnmpbnnognpmfb' },
    { locale: 'iso_639_1_tr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3G/tB8EoYR2ECOgWfDIiUQyNhzfJQHiZzQ4HNOAW8gcPp22+j2B3fxIchZG0gk0LXChLAN33Nn5Hr99h59MfqHRio+oxD+IrwFW7PIo1NyPqMaDDpcUpOnNny6BC9A+pQB0qOKnmV7IfHjSZxwaRRp6Zjy7UsnvZuXn7dW/VPOCjBdhzbZah6yUkw27u11e9X1+uKF7kplSLGMlwxi9lmqOAgcplucuy8X2n6dlC8RA6spvy6E1TiV8PtCkFbz+3aiaN9l0fPy1ZjTQGfW1/PGXCkS3rAXhlZN9nk9coDNbGSt6EOg/JxWtlCXRsIV/0ahI1WIfobuzIfVLDaTH9CwIDAQAB',
      id: 'edjnpechdkjgcfjepfnnabdkcfcfllpd' }
  ]
 }

 const stageFiles = (locale, version, outputDir) => {
   // Copy resources and manifest file to outputDir.
   // Copy resource files
   const resourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'resources', locale, '/')
   console.log('copy dir:', resourceDir, ' to:', outputDir)
   fs.copySync(resourceDir, outputDir)

   // Fix up the manifest version
   const originalManifest = getOriginalManifest(locale)
   const outputManifest = path.join(outputDir, 'manifest.json')
   console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
   const replaceOptions = {
     files: outputManifest,
     from: /0\.0\.0/,
     to: version
   }
   fs.copyFileSync(originalManifest, outputManifest)
   replace.sync(replaceOptions)
 }

 const generateManifestFile = (componentData) => {
   const manifestFile = getOriginalManifest(componentData.locale)
   const manifestContent = {
     description: 'Brave Ads Resources Component',
     key: componentData.key,
     manifest_version: 2,
     name: 'Brave Ads Resources',
     version: '0.0.0'
   }
   fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
 }

 const generateManifestFiles = () => {
   getComponentDataList().forEach(generateManifestFile)
 }

 const getManifestsDir = () => {
   const targetResourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'manifiest-files')
   mkdirp.sync(targetResourceDir)
   return targetResourceDir
 }

 const getOriginalManifest = (locale) => {
   return path.join(getManifestsDir(), `${locale}-manifest.json`)
 }

 const generateCRXFile = (binary, endpoint, region, keyDir, componentData) => {
   const originalManifest = getOriginalManifest(componentData.locale)
   const locale = componentData.locale
   const rootBuildDir = path.join(path.resolve(), 'build', 'user-model-installer')
   const stagingDir = path.join(rootBuildDir, 'staging', locale)
   const crxOutputDir = path.join(rootBuildDir, 'output')
   mkdirp.sync(stagingDir)
   mkdirp.sync(crxOutputDir)
   util.getNextVersion(endpoint, region, componentData.id).then((version) => {
     const crxFile = path.join(crxOutputDir, `user-model-installer-${locale}.crx`)
     const privateKeyFile = path.join(keyDir, `user-model-installer-${locale}.pem`)
     stageFiles(locale, version, stagingDir)
     util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
     console.log(`Generated ${crxFile} with version number ${version}`)
   })
 }

 util.installErrorHandlers()

 commander
   .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
   .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
   .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
   .option('-r, --region <region>', 'The AWS region to use', 'us-west-2')
   .parse(process.argv)

 let keyDir = ''
 if (fs.existsSync(commander.keysDirectory)) {
   keyDir = commander.keysDirectory
 } else {
   throw new Error('Missing or invalid private key directory')
 }

 if (!commander.binary) {
   throw new Error('Missing Chromium binary: --binary')
 }

 util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
   generateManifestFiles()
   getComponentDataList().forEach(generateCRXFile.bind(null, commander.binary, commander.endpoint, commander.region, keyDir))
 })
