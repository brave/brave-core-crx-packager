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
    { locale: 'iso_3166_1_gb_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7L65ymlZt+jRoLsulYP60EtHUcVL+BNs9qdJMDP+UvPlN/eHrjaaRy5uJgQCyTVP1cS20GCTD/d4YhNtMSoNiMfaIInaHzxx4nRu2ipfrpzrypV7LmmDCajrlsIwhiRvDevn8057/k4+J9TuDR3JuRTcCXxNv+LNHCYNcE2DKQDACv1c4CQ6sqasmkhle49UBrhKLiu/mSKmLBAJ45mRNwpKXtFMzNZB2US0BynoHco1rJIVrtx3Y2K2JBW1DqDohrb76J6+2KzcR7Zx55Haca7MhGZ9Mf9+tf5rzjdjIewF79PbX8xNMb0xmw05fekAjJjeLrJygL7BKQNN4BashQIDAQAB',
      id: 'cdjnpippjnphaeahihhpafnneefcnnfh' },
    { locale: 'iso_3166_1_jp_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArBgclTrukKlWqH47I5tP+i/agOow6Kb6UW0pW9FjrfQ26kFiTfYaTFPEBGcM2Qh8pu5fPWI1R2lF1elmF+JKZMdx5286SMuOpfKL8gekfYolt/wDRPNJgPdEleZwGXL3FJVwb5yYee2hFsDlXgDBuR24HwGsZ/bZolnLkMMtonsBzD8IDNyGBEsBOjIRePrShaCFiqLJqcFhTQtLAOCWqmU1Cmf5PxIiBSD3egFQXSdnuDwtORMXqcx9WOQeddtaQKTskHHZyPAbQZhV6h7GFjxMz7EZxrkPBiDiB4p7AcHwI6ZrjvJFzB5AvO7E0SMr6PUJ0DW9G6N21sX0vcBnMwIDAQAB',
      id: 'ienmdlgalnmefnpjggommgdilkklopof' },
    { locale: 'iso_3166_1_us_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA09bImTdimqDHKRK9SGQrxfLxwCVC/fNbPskVhhdyqLV7KsNA4isJaInByxgAllOc0xAXgeSTUx8iq7+33mwj3tZUYxaL3e57NjTQ4Ymm38UIjAD+yS+Wh5icdOW4EtMN41EMEJTrQup9WsKU+SxzL/+A/jcYdrkRMZKHixKHrQxnZ5QUrPitV54/YD+kcYNmGVFpQcHn8fJbvNSLchaFi7D+3KQSWwIS/psPG/Ni3Xi2PcSPRTMN9O09lNyyjA+twFqNhSd13IHlDTVEWE4a0MIR3/4MNQHLMLhchoDokc0Hy+ysSy0ipDCh0iTwLt4FhsMS9e2vIXG9IpzNqE4EbQIDAQAB',
      id: 'kkjipiepeooghlclkedllogndmohhnhi' },
    { locale: 'iso_3166_1_ca_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxhI2yhy1vb6QcmKS+atjzXnNPbtDPX0svPt/A0SPWbCpcMAupfhlKLBOOnc0pSWJM7HtfUoHqXxgYV56EiBvhgNDWinW8gXmQoIXRJigYS8g9MgV1TRaQ3CdHCaPD6SrY6QZ0EQZHpWvd2OH+LQ+hGbyP8xVCEIiATWn0PPyzcw96pV7o3TLX7pSxPOxphsPOIWkB8Ca224FRzgQUo3FEgA2XgArVX09l5jmFMTagdcpfOH0Hba+q1Z+Vt4B7Jy9/QagqgwnzVnYWYyPGaZVJrhhNHk8Rllzfde/zlnoJYYNXCZoX/QPjgtEHtEHjPweJ+GL+o4UH4k23L+267f99wIDAQAB',
      id: 'gpaihfendegmjoffnpngjjhbipbioknd' },
    { locale: 'iso_3166_1_de_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwdQCKsrqWCC4IFMCjEvm5rK7uZQlKGg9JwwjcUm7/A4SRmKMgmjxqo64DpejJylLemQQf0Z/o00d6hqon+QjjfZb5ers+lx9d1RVk3NAjzkBWrLQ64JK9fAfhnABvfaI06tbSfGthLteJyeoP4yDUHy4iElbrZMJM7yohkkyvNfExomlZ0vIqfii6nNKPuPsa5N1gQMUh9pZ+OeRfMCko1QIyEuLwoP94Hv2Ho1hc+t38sKIXDESwaabXc+1Q+qoq/e12jJzEImYcsJnqXp7kUJOA2l7pEun6Kbio5Zqvdj0KdUWhoBh8WlGp6ykhSoHsp2flwhaK7b8HQx+R7oeiQIDAQAB',
      id: 'dgkplhfdbkdogfblcghcfcgfalanhomi' },
    { locale: 'iso_639_1_de_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw6fYL/onqsR2Eqr2lif68RY8/KSB9e0r6rOXlo6qclUckngboamWnQGZnW8LNrN7fyVjUnsK0OCLzRkOEyEm3hOnmUlROYgk2NvSIzrAhq5PA8M2xc9siU00myQ+IOhbVcNDSOxpbrX9w3e6rA9MwrytywGtL58nDWyOcFgMwfkzQHfxVxeu/rkQODkNEgXZl2t9Jd+1eHCSfleuJeNVfb9OaZ1rjVWwETHwk+Y3w2LHcS2JtFXcA7O9QI/w+s4uYGMogZKwrZG7sYZtAftOOERPrSFJDux/MNjVtm8Rpk0ZWFRIUmVWf6PnFbX6UjtJY2qAN0Nsq27TNvVKCpdz5wIDAQAB',
      id: 'eclclcmhpefndfimkgjknaenojpdffjp' },
    { locale: 'iso_639_1_fr_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx1/9cmzkLNdnqefKfXfJseIA6Js0e1PC2pkCnkXbMIRBCtvvq86LhUDvERrJZ4UD/zd2YNoRUu9nqMTNpj6IZKfXwKtNwMo5yY1B2KmdOQo4MgIIf+uLVOTc18ylq0WrmLvcKW2cSvD9jR1nY1IR7eZ8n7MAriMJufckAKMpvI72/ylTYUAT5mg+o9JOghx7mixa2OGn1LC3tPlF6kqdBD06z8XBO+mpF5xlLk9CiCYiTdF1V+GiVniDX8XoJ5+nFWJolw0GVEjckFSlZiYCazUox3M2BlURLxxSjZBm77GjdMVosV5+0n0tPJ/Fjb+NnPmslcjo944DmGgzLQ1nQQIDAQAB',
      id: 'hbejpnagkgeeohiojniljejpdpojmfdp' },
    { locale: 'iso_639_1_ja_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvJFbfap/j/4+DJ4FFY2zZHbm14SxpZIyoRwtCSoNKh9HsO9mt+9blnntHmaLDhZ7ITCCux8xy8pQZ/7ztsfm+DplzpDBIasS2T1FsE8VXBE/vL2xzlvo+FTXmgHg+3H6GW/0r7bzGuYml9fZv1aHBGTeajBH7LebLMYV6qlSL3K/iuiHEh+Qq95dqUKcrY28CPPriUzpyLWpQQKV0M3Z5++o04rf0jbOswHN8LSSG3HYB1BzxhPhaEco1Pn3fuxNVM69GXr5huQm8fWxViQHFcWWCd/emRC7MAPHBLuUy5i1QvIjfzfa2DZqwl03hw6m/NzzGIGMYXU3SniystOC4QIDAQAB',
      id: 'ncnmgkcadooabjhgjlkkdipdnfokpjnm' },
    { locale: 'iso_639_1_pt_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtZsD7mfrycGNo2orydis1b/tBCCuPzZdW5TjIgsridYH+hi9C4YkYgvfQ3WNFZHUnvQEsYhOSKr7hhDfGJB8kuZrPMnLnAX6ADjvPQSPPwYhbyBgpkmkVRi649oupVfuqEgJxFAJST7H/vLEMJA+gDHjxxyh+7J/EQbMNho+MgG+aGcQDvCDmax+g3+MXh97r0B/1mrOyskF4zP0q+zclcJVOsefgRGr+h0DbTHtMLWrrvbBO3rsM+7TaX5QTyYm5XgWI7Zt4VoiAzdS3YQCpQf5Simj1yFVFC0TfI8+LXuElBT72bADfRfLh/pVmcx1h2Uv7uK/9eYTVxmbmKxRcQIDAQAB',
      id: 'ikpplkdenofcphgejneekjmhepajgopf' },
    { locale: 'iso_639_1_es_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAonX2Nny33Q7yAmw8OIuaofnbejVaueiBA+lOqTCaMtxB4JcKa5G/FIzs7OQJiIkY7OiPAT7GvaitJP3IUAJNMRZ3O00ZvG7Gg7hkzrQLRk6920d2U/muw0DiY122JUdzadawm67C5WPznzNgOUxSmejkKcvv7Sj9AXf0wbjAd0BSfdPJKOsbtI4A9HAy9Hi88vMTvni/dic3VHnwo6tttz84yUgWEyweT3YKjrdsokJwmJZTV3Bi+o0ZeNOQigPBg0KFwxUCUWA82ZIJ4C/FyE8oZQ0gGE1LPnFw5pXVWfxlGqxGYr5hiPUZFDBIlpTye2utwrjsY3erjJ3zy93HUwIDAQAB',
      id: 'ahiocclicnhmiobhocikfdamfccbehhn' },
    { locale: 'iso_639_1_ar_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6z+dCLvbhHdl5pwuqPFAh72RfVeq1d73hrOdsD/+d01akpRwvupsYVDlzN3yC0RSr93UrUuvuXoq6dxq+SVprzhzC8ZstHp3qOkA9tF/ln0V8VovRJqdZzMQA4zVQmhC5JtlGfVe9uSh8lp7OaGwmLieu21j8tlqz+dJQCjBEb/yAp0rlU8VDUs8CtLfv6p5ZT6bKR6iBbo5BLRO+ptfHWuVqvfgyIM+TqGfNN077a60p7NwKgLKumh1RMwwPgc+7R70DkWK/a5AfdK0AwBSXBRL4Yq3VZh5DlH3cIdrO1G0boJ5hEVtqu740KJpt2tezbsMimXbREwQFOI/ediW0QIDAQAB',
      id: 'hfiknbegiiiigegdgpcgekhdlpdmladb' },
    { locale: 'iso_639_1_zh_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmfUsqpiVPaGx1vwWmCZJYnf61Db5HTT67twW62Iwk8Z7e6KFcbJhAbphZo6okR4DsaoGp79ioV4Gcj8lGRZ0pYMSZO8cJNoSCYnC8fzNg3JpWX04fW/HXAXGoZcI5mTT6cS8Ip8SWAvbLSC8UqhxX8a8ATRTwSTZO3Wl7WYvR2LQLAndDdFSSI8XhJsARdR0QxDKv8mxyT4Q9t/mo5HJ8LVQwwYqqo5g8zHIAqPVQ0ldxrpLCNnU90t7AEdaLGfqG9gBoRQQ0yf9oQtowoTR4DdRNkdh/ERFtTnANYV1dWicnp+DtTGXcNgsE/yK3mVvblOCKySi+Km0Tn4ZpLEq3QIDAQAB',
      id: 'oblfikajhadjnmjiihdchdfdcfehlbpj' },
    { locale: 'iso_639_1_nl_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwuyw7uEhryLMlXraRHSLu8yGSZYr9wAyrbLoEf97alu959jAvNLOvmI3GXMzb9Qw1mujfTgokaVsjtUYKJwED+fEODk5cUt19oNwPzBGPGIp/UjlGFejJtSD8RO1EErj+0ZQRFBYs/u4kbqIm+1kQ6ITQhthdKfORzVxYIMwXZA1ikioRf1OtHVvWQ+QU9fTMpTlnf8JXW5P1ngzLYCak4+3Ta2BxUayCr4N6/9lQN5frHQOctx04Q7F69YIbV/ua3wCxuYBJUhVMG4pKviMg4knaHOx6KPe4NveYe4z0gnRGRGbi0NKGg28mgBdJdwrwVNQ9T8Pza8Gy+uNk5MLiQIDAQAB',
      id: 'opoleacilplnkhobipjcihpdoklpnjkk' },
    { locale: 'iso_639_1_fi_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwkDWIBN0RdJQIuJQ23HNc+cF9L9gAne+wZuCY2ceyN1OTEy6NS9MqjeFTleOmUpf2aVkQNy6CDbKh5+1nVuukBqo6J2EzXkgs9oTzE2ylXoSPRmxZiFwnphdpQTMGK/fBNGAdjkq7Vx1q3gTXifUmOfU2BAbk0tks25Cj/MwsjjaI4mI6+XsEvvt8SXY3X8xksqmjJvOsLs+glgKKnbzErwPxq9Hv88d9tvPS8kpoihQ5DKJ1pIbNPO+HMaZgTAf/+1Kk1jVsjl7n6iEvXFtfTWEPOQF7VMepomlWAiT2MTIYNQo9zixfrp2hF1UHZx2q8WYuhlXfUfkd4A87W1j4QIDAQAB',
      id: 'djokgcimofealcnfijnlfdnfajpdjcfg' },
    { locale: 'iso_639_1_el_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApAiAA2oeCATGYZo2O8kjwJ2dcVS6a6iBQ+dNQofT9I+12WcIxqbF6A3y9Gja/7RWqak18v39oiruYfhXT/oD81FT0PlNPbDcnV8zry2llVUrLa1yoCd3yxGNmIcaLYOHRUiunJ+dVXEx4MEU9IrKnEGQ/e/R7VukXNxPKJGXv7sawCz5FyQjSYr3fmL5qISiF9vgXKAf4WyXGD2+pWZAvUnT9JUcE2Fd7gT4WcCK4grwUlhSACn+juoGEoEtUmNRzpO3DFQe6XLepS2zrHOam+FovzAcu0D7bP67VDpn/wUU4GbWuVxbLgqZWVM+FzFPObP87iNBp2dYVu1ISwh6IQIDAQAB',
      id: 'aefhgfnampgebnpchhfkaoaiijpmhcca' },
    { locale: 'iso_639_1_he_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsVJ++kpL8skJFkCNMUhLi0ZlaeGFzXdec8RjkTY5mILEBMRmKAjYXgvCjTMoU12dqtlYaRr9FeCIVgIo9ohRQn4Mzm6uQGYzUq3HaW1wvV9PtMQVIoMGarQMjef8Ywcb6+yrLvo5yc6c+apQAiW+UD8mnVhQkQ4PcsSD10mxR6KQ+BtKUDefnZWONTzeDLY5zKDLZLmdx9hr6ivzeZoC5FyV/aXimflIOTJzkuPetehx/gaovsnqAoY8g4J7Cm5kRQJeE424ZPdNU9KggeqPMg6I1Ju1KcfRUlU9a89UZbR58vvmeoSHA8wLK53JVvJ9lz9vjCwfrzrnqHEAAhoPOwIDAQAB',
      id: 'gffjpkbdngpbfkflpnoodjfkpelbappk' },
    { locale: 'iso_639_1_it_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvE1PSKf63DKEactzc2nxv4OjxMTBnjalsb2SxsbekwsRKiLfmEjryw6veyZE1Gut03mGsORehQfGdZmML+B5cFRwNEAVWD/4DTqxWzWszjfZR2YjxX+MNsxtwKUuMAo7jZ4R14fOOR/fzeBr+W2aJqgfr25gx7xRwvGOwaacj0T9fsHxR1fngp08wmbSdCYKqVS/KTMwkRcqzWdG3ITB8tl3qz4mP873wXMbq0X5I9Qi5klyDGnehckuZKg2HEPkDxRI4RiJZ/gQpU1dsAdfqNiCYrzSTyMoJBz6cfypPhWzUD4FO4ZPU3KpBzcI8AUOvlAhX28jmSdEIcT5Iwon3QIDAQAB',
      id: 'ijaiihoedhaocihjjkfjnhfhbceekdkg' },
    { locale: 'iso_639_1_ko_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuuV5Wt3NQQ/UPSxzI3LA4gf4DXS/tBfv7CaqzxQ8hPS/AdrqBh0hlQ6spezX8tqUluEKGTEH19jZo4ZHqN3LuP+Cwrc/EL2mx2GLqBwY1tnG+UK2ue2ldVO0S2ls9xc2T6TMegk0s3EAv+syP4p9teqwyKAA9BpN6rKGLGnDfyBKlH7xbMuZ7YnTRDDO84pwiBSXF2TUhMdrV69VYJnrDUtgev+zeGN5paecgnUFi/LdKQpYK2oDF9NeF3Zsrth2ZEjoycKfoMMyGWyi7egd7SGg3lJ0nnjL6YW4dCaHTEdDjmLPK3gqaV5AqU+S6K1UMF2+vmDDihQeXXqDb+8OcwIDAQAB',
      id: 'jbhiacghlejpbieldkdfkgenhnolndlf' },
    { locale: 'iso_639_1_pl_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqsq5PBHdTBkvm5Gae/Mde90jzz5Ihs2fIEQjV7Ee/k4sYKaKg9TTLPCC3q7cUgAqsMVXrNLqlt3W6L2x6dN78HTWv2qvd29+RuhxplOoYnlqz6cJGNtsVhBzwx2v/EyxxCNXMRAEu8UOWePeV28xfW1xDKYnD5G7ZkvRHr15AjYl0R6wqjZPSp6SzHkZ3giFREAUDinvuQFIOFQRfQRz0DWgQm33Lu/lfPmLrrgC7KBCjx1Y5psXAhi1nnzRihE0jaz2N7DNQPKH9XvQlCI+mWnaKVLhKxGYzgHJWlXAXVR+zOo2QWU1kaZ3EcX9VMgBcPRd/Mq9CCpLZfx3Ko6OsQIDAQAB',
      id: 'aijecnhpjljblhnogamehknbmljlbfgn' },
    { locale: 'iso_639_1_ro_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuo2GL8YUL9ZDpJbzDohxMBHXOz7Mb54LSWLlMfn9PjfQXCMFUxxtbCMiEHx0Mu7L6C91uOq4AQAg1dc1sVcQSvOyPu+4jTXLmgjoCo3/8C2xNebnG/PnQxiV2EsC+U+9KZr+OatvLadPf8QwPovY43mZspW+sQ2oqJWmx3nDXAaJ5siyYDB3SEl95ZL6ZG5oZV+8cu94XX2OLXPcv/YWh+n7OfSZSkEuTw6vzivJlNJESq/QDBpnyDM03xrnHuV9oZtwK6J7qm3KQHEJoa3x5THMOWDH0aTWj1bJ5YkPzua5px5IZuWyGoOX1N1zyFa3hPOo0DgKm67tNkufkaoQBQIDAQAB',
      id: 'hffipkehifobjlkdjagndofmpjnpkgje' },
    { locale: 'iso_639_1_ru_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyFHH17BmNBAOAxjsNFUJ3tkWoEI9Z0r8wBbClOvEWNO2+yynTn7uNiMPKtHcghGn46gzVUaUkm4KzbYKmIe0ksYug5XfNfANS2Qglz5WeOB0HRsFwVBaohLmAlEKWjXq9bCpC45RyPyPCzMmBkksv6nesLzh0roDMob56s4XftujS/foCnAEba2Z+XENhTfpb/PCFyE0USAG6LFTcgGylXmL6P5qcZHfbrQCzXVNfJHXsbRH6E3ElI5qlKZbPfUbgbYaZnwu+b3bTY1NJPahH9qkmrWWGMn7Ffi8jzI6F1agEPv4Z+YgM59YFhh1IAe0Ric11GwoMH7UWkWU+y2zGwIDAQAB',
      id: 'nigmjcnboijpcoikglccmoncigioojpa' },
    { locale: 'iso_639_1_sv_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1wKdbZINz3JWjoC7nj80MJPI3zKkxg2w4o3pfHVqR9wu4BcZ93GYwQiXIK1Wnt51mUamRJqLyiCi/7LyGoUyOTxCojKdi4D/2GfH43jZQ6LB4ye6IZpf+RVpVGeLscczY0bjJCw5/QRMmL93HKoauw9CVVI0DVu4Q0UQc5W2liMDsBqmtb2ColE00OmLJMinLC8Ofc9bwzG6AzIeyCDBleupSVGoBe12+ZWsCRtPMhjTUnCP0OtCA97vUUd86kL8AAvWjtgHszhy4dnvzLvhzzr0cMbu5fQSNkJAP74VBh7BOMd0A+621lNtlxthKZ5D17LUJiPRAbTxaqu1sbAgQIDAQAB',
      id: 'jpgndiehmchkacbfggdgkoohioocdhbp' },
    { locale: 'iso_639_1_tr_deprecated',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2zgQlQjqC1r4oykLjVE9LmN8U32KNTNp6M8LpcKA7abk+fBUOUeUebwANxupxw7AxUkoESyT5LBdVNl9Ncnmj1YF9mWB24i52+7qhDaYR9R3Bf13XMNf7J9FLQtabxCvvGv8l0CQV4+DvIiGDH0fPDTWbG5TnZfXlMUC2iUPaNfh9DnFubu37pkT4Q9NmSsy+B4OBZ1aaIS9q8dQ7QDJ2UuXVZcZHk0WEU2H/zEzyGCgRaTZFiTX1dfq919GEoLOQNPqdDE60dRBnAU4twT4uVIyLMftY8pkmd8A596AAWuxJdr0fxFu8EaHdlZtYJLI17irgvR5DlPITlzRyFvzKwIDAQAB',
      id: 'kpdcfihnokkbialolpedfamclbdlgopi' },
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
