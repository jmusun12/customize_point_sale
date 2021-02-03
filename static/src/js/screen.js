odoo.define('pos_invoice_customize.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var rpc = require('web.rpc');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var Printer = require('point_of_sale.Printer').Printer;
    var QWeb = core.qweb;



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


    var PaymentScreenWidget = screens.PaymentScreenWidget.extend({
        template:      'PaymentScreenWidget',

        send_receipt_to_customer: function(order_server_ids) {
            var order = this.pos.get_order();
            var data = {
                widget: this,
                pos: order.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };

            var receipt = QWeb.render('OrderReceipt', data);
            var printer = new Printer();

            alert('Widget Override Success');

            return new Promise(function (resolve, reject) {
                printer.htmlToImg(receipt).then(function(ticket) {
                    rpc.query({
                        model: 'pos.order',
                        method: 'action_receipt_to_customer_override',
                        args: [order.get_name(), order.get_client(), ticket, order_server_ids],
                    }).then(function() {
                        alert('Widget Override Success');
                        resolve();
                    }).catch(function () {
                      order.set_to_email(false);
                      reject("There is no internet connection, impossible to send the email.");
                    });
                });
            });
        },

        post_push_order_resolve: function(order, server_ids){
            var self = this;
            alert('Widget Override Success');
            if (order.is_to_email()) {
                var email_promise = self.send_receipt_to_customer(server_ids);
                alert('Widget Override Success');
                return email_promise;
            }
            else {
                return Promise.resolve();
            }
        },

        finalize_validation: function() {
            var self = this;
            var order = this.pos.get_order();

            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer) {

                    this.pos.proxy.printer.open_cashbox();
            }

            order.initialize_validation_date();
            order.finalized = true;

            alert('Widget Override Success');

            if (order.is_to_invoice()) {
                var invoiced = this.pos.push_and_invoice_order(order);
                this.invoicing = true;

                invoiced.catch(this._handleFailedPushForInvoice.bind(this, order, false));

                invoiced.then(function (server_ids) {
                    self.invoicing = false;
                    var post_push_promise = [];
                    post_push_promise = self.post_push_order_resolve(order, server_ids);
                    post_push_promise.then(function () {
                        alert('Widget Override Success');
                        self.gui.show_screen('receipt');
                    }).catch(function (error) {
                        self.gui.show_screen('receipt');
                        if (error) {
                            self.gui.show_popup('error',{
                                'title': "Error: no internet connection",
                                'body':  error,
                            });
                        }
                    });
                });
            } else {
                var ordered = this.pos.push_order(order);
                if (order.wait_for_push_order()){
                    var server_ids = [];
                    ordered.then(function (ids) {
                      server_ids = ids;
                    }).finally(function() {
                        var post_push_promise = [];
                        post_push_promise = self.post_push_order_resolve(order, server_ids);
                        post_push_promise.then(function () {
                                self.gui.show_screen('receipt');
                            }).catch(function (error) {
                              self.gui.show_screen('receipt');
                              if (error) {
                                  self.gui.show_popup('error',{
                                      'title': "Error: no internet connection",
                                      'body':  error,
                                  });
                              }
                            });
                      });
                }
                else {
                  self.gui.show_screen('receipt');
                }
            }
        },
    });
    gui.define_screen({name:'payment', widget: PaymentScreenWidget});

});