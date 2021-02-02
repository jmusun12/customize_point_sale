odoo.define('pos_invoice_customize.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var rpc = require('web.rpc');
    var _t = core._t;

    screens.ReceiptScreenWidget.include({
        renderElement: function() {
            var self = this;
            this._super();
            this.$('.js_print_invoice').click(function(){
                self.click_print_invoice();
            });
        },

        click_print_invoice: function() {
            var order = this.pos.get_order();

            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'pos.order',
                    method: 'action_invoice_to_customer',
                    args: [order.get_name(), order.get_client()],
                }).then(function() {
                    resolve();
                }).catch(function () {
                    order.set_to_email(false);
                    reject("There is no internet connection, impossible to send the email.");
                });
            });
        },
    });
});