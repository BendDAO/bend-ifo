import rawBRE from 'hardhat';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';

import {
  deployBendCompetitionTest,
  deployCryptoPunksMarket,
  deployMintableERC20,
  deployMintableERC721,
  deployTreasury,
  deployWETHGateway,
} from '../helpers/contracts-deployments';
import { DRE, waitForTx } from '../helpers/misc-utils';
import {
  BendCompetition,
  CryptoPunksMarket,
  MintableERC20,
  MintableERC721,
} from '../types';
import {
  getEthersSigners,
  getSecondSigner,
} from '../helpers/contracts-getters';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';

enum Stage {
  Prepare,
  PrivateSale,
  PublicSale,
  Finish,
}

describe('Competition', async () => {
  const oneBend = new BigNumber(1).shiftedBy(18);
  const oneETH = new BigNumber(1).shiftedBy(18);

  before(async () => {
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    await rawBRE.run('set-DRE');
  });

  it('should not cliam in Prepare stage', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    expect(await bendCompetition.stage()).to.be.eq(Stage.Prepare);
    await expect(
      bendCompetition.connect(secondSigner).claim({})
    ).to.be.revertedWith('not in the right stage or not in the whitelist');
  });

  it('only whitelist can claim in PrivateSale stage', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await waitForTx(await bendCompetition.nextStage());
    expect(await bendCompetition.stage()).to.be.eq(Stage.PrivateSale);
    await expect(
      bendCompetition.connect(secondSigner).claim({})
    ).to.be.revertedWith('not in the right stage or not in the whitelist');

    await waitForTx(
      await bendCompetition.addToWhitelist([await secondSigner.getAddress()])
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.1).toFixed(0) })
    ).to.changeEtherBalances(
      [bendCompetition, secondSigner],
      [
        oneETH.multipliedBy(0.1).toFixed(0),
        oneETH.multipliedBy(-0.1).toFixed(0),
      ]
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.1).toFixed(0) })
    ).to.changeTokenBalances(
      bendToken,
      [bendCompetition, secondSigner],
      [
        oneETH.multipliedBy(-0.05).toFixed(0),
        oneETH.multipliedBy(0.05).toFixed(0),
      ]
    );
  });

  it('everyone can claim in PublicSale stage', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());
    expect(await bendCompetition.stage()).to.be.eq(Stage.PublicSale);

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.1).toFixed(0) })
    ).to.changeEtherBalances(
      [bendCompetition, secondSigner],
      [
        oneETH.multipliedBy(0.1).toFixed(0),
        oneETH.multipliedBy(-0.1).toFixed(0),
      ]
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.1).toFixed(0) })
    ).to.changeTokenBalances(
      bendToken,
      [bendCompetition, secondSigner],
      [
        oneETH.multipliedBy(-0.05).toFixed(0),
        oneETH.multipliedBy(0.05).toFixed(0),
      ]
    );
  });

  it('should not cliam in Finish stage', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);
    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());
    expect(await bendCompetition.stage()).to.be.eq(Stage.Finish);
    await expect(
      bendCompetition.connect(secondSigner).claim({})
    ).to.be.revertedWith('not in the right stage or not in the whitelist');
  });

  it('should claim only MAX_ETH_PAYMENT_PER_ADDR', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(10).toFixed(0) })
    ).to.changeEtherBalances(
      [bendCompetition, secondSigner],
      [oneETH.multipliedBy(1).toFixed(0), oneETH.multipliedBy(-1).toFixed(0)]
    );
  });

  it('should reward only MAX_ETH_PAYMENT_PER_ADDR * BEND_TOKEN_REWARD_PER_ETH', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(10).toFixed(0) })
    ).to.changeTokenBalances(
      bendToken,
      [bendCompetition, secondSigner],
      [
        oneETH.multipliedBy(-0.5).toFixed(0),
        oneETH.multipliedBy(0.5).toFixed(0),
      ]
    );
  });

  it('should draw dividend', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const wethGateway = await deployWETHGateway([]);
    const treasury = await deployTreasury([]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: wethGateway.address,
        TREASURY_ADDRESS: treasury.address,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());
    expect(await bendCompetition.stage()).to.be.eq(Stage.PublicSale);

    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0).toFixed(0)
    );
    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.1).toFixed(0) })
    );
    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0.1).toFixed(0)
    );

    await expect(() => bendCompetition.drawDividend()).to.changeEtherBalances(
      [bendCompetition, wethGateway, treasury],
      [
        oneETH.multipliedBy(-0.1).toFixed(0),
        oneETH.multipliedBy(0.08).toFixed(0),
        oneETH.multipliedBy(0.02).toFixed(0),
      ]
    );

    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0).toFixed(0)
    );
  });

  it('should auto draw dividend', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const wethGateway = await deployWETHGateway([]);
    const treasury = await deployTreasury([]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: wethGateway.address,
        TREASURY_ADDRESS: treasury.address,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(5).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.multipliedBy(0.001).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.multipliedBy(1000).toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());
    expect(await bendCompetition.stage()).to.be.eq(Stage.PublicSale);

    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0).toFixed(0)
    );
    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(1).toFixed(0) })
    );
    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(1).toFixed(0)
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(4).toFixed(0) })
    ).to.changeEtherBalances(
      [secondSigner, bendCompetition, wethGateway, treasury],
      [
        oneETH.multipliedBy(-4).toFixed(0),
        oneETH.multipliedBy(-1).toFixed(0),
        oneETH.multipliedBy(4).toFixed(0),
        oneETH.multipliedBy(1).toFixed(0),
      ]
    );
  });

  it('should print ui data', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);

    const bendCompetition = await deployBendCompetitionTest([
      {
        WETH_GATEWAY_ADDRESS: ZERO_ADDRESS,
        TREASURY_ADDRESS: ZERO_ADDRESS,
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        LEND_POOL_SHARE: 8000,
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let uiData = await bendCompetition.connect(secondSigner).uiData();
    expect([
      uiData.remainDivident.toString(),
      uiData.bendClaimedTotal.toString(),
      uiData.bendPrice.toString(),
      uiData.remainBendBalance.toString(),
      uiData.stage,
      uiData.bendBalance.toString(),
      uiData.maxETHPayment.toString(),
      uiData.maxBendReward.toString(),
    ]).to.be.deep.eq([
      '0',
      '0',
      oneETH.multipliedBy(2).toFixed(0),
      oneBend.toFixed(0),
      Stage.Prepare,
      '0',
      oneETH.toFixed(0),
      oneBend.div(2).toFixed(0),
    ]);

    await waitForTx(await bendCompetition.nextStage());
    await waitForTx(await bendCompetition.nextStage());

    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.1).toFixed(0) })
    );

    uiData = await bendCompetition.connect(secondSigner).uiData();
    expect([
      uiData.remainDivident.toString(),
      uiData.bendClaimedTotal.toString(),
      uiData.bendPrice.toString(),
      uiData.remainBendBalance.toString(),
      uiData.stage,
      uiData.bendBalance.toString(),
      uiData.maxETHPayment.toString(),
      uiData.maxBendReward.toString(),
    ]).to.be.deep.eq([
      oneETH.multipliedBy(0.1).toFixed(0),
      oneBend.multipliedBy(0.05).toFixed(0),
      oneETH.multipliedBy(2).toFixed(0),
      oneBend.multipliedBy(0.95).toFixed(0),
      Stage.PublicSale,
      oneBend.multipliedBy(0.05).toFixed(0),
      oneETH.multipliedBy(0.9).toFixed(0),
      oneBend.multipliedBy(0.45).toFixed(0),
    ]);

    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim({ value: oneETH.multipliedBy(0.9).toFixed(0) })
    );

    uiData = await bendCompetition.connect(secondSigner).uiData();
    expect([
      uiData.remainDivident.toString(),
      uiData.bendClaimedTotal.toString(),
      uiData.bendPrice.toString(),
      uiData.remainBendBalance.toString(),
      uiData.stage,
      uiData.bendBalance.toString(),
      uiData.maxETHPayment.toString(),
      uiData.maxBendReward.toString(),
    ]).to.be.deep.eq([
      oneETH.multipliedBy(1).toFixed(0),
      oneBend.multipliedBy(0.5).toFixed(0),
      oneETH.multipliedBy(2).toFixed(0),
      oneBend.multipliedBy(0.5).toFixed(0),
      Stage.PublicSale,
      oneBend.multipliedBy(0.5).toFixed(0),
      oneETH.multipliedBy(0).toFixed(0),
      oneBend.multipliedBy(0).toFixed(0),
    ]);
  });
});
